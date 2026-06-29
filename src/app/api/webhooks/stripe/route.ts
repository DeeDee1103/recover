import { Stripe } from "@/lib/stripe/client";
import { createServiceClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { success: allowed } = rateLimit(`webhook:${ip}`, 100, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Idempotency check
  const { data: existing } = await supabase
    .from("processed_stripe_events")
    .select("event_id")
    .eq("event_id", event.id)
    .single();

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Mark as processed before handling (at-most-once)
  const { error: insertError } = await supabase
    .from("processed_stripe_events")
    .insert({ event_id: event.id, event_type: event.type, processed_at: new Date().toISOString() });

  if (insertError) {
    // Unique constraint violation = concurrent duplicate
    if (insertError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("Failed to record event:", insertError);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  // Route by event type
  try {
    switch (event.type) {
      case "invoice.payment_failed":
        await handlePaymentFailed(supabase, event);
        break;
      case "invoice.paid":
        await handlePaymentSucceeded(supabase, event);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error(`Error handling ${event.type}:`, err);
    // Still return 200 — we recorded the event, don't want Stripe to retry
  }

  return NextResponse.json({ received: true });
}

async function handlePaymentFailed(
  supabase: ReturnType<typeof createServiceClient>,
  event: Stripe.Event
) {
  const invoice = event.data.object as Stripe.Invoice;

  const merchantId = await resolveMerchant(supabase, event.account);
  if (!merchantId) {
    console.error(`No merchant found for account ${event.account || "(direct)"}`);
    return;
  }
  const customerId = invoice.customer as string;
  const customerEmail = invoice.customer_email;
  const customerName = invoice.customer_name;

  // Upsert end_customer
  const { data: endCustomer } = await supabase
    .from("end_customers")
    .upsert(
      {
        merchant_id: merchantId,
        stripe_customer_id: customerId,
        email: customerEmail || null,
        name: customerName || null,
      },
      { onConflict: "merchant_id,stripe_customer_id" }
    )
    .select("id")
    .single();

  if (!endCustomer) {
    console.error("Failed to upsert end_customer");
    return;
  }

  // Check if we already have this failed payment
  const { data: existingPayment } = await supabase
    .from("failed_payments")
    .select("id")
    .eq("stripe_invoice_id", invoice.id)
    .eq("merchant_id", merchantId)
    .single();

  if (existingPayment) return;

  // Create failed_payment record
  const { data: failedPayment, error } = await supabase
    .from("failed_payments")
    .insert({
      merchant_id: merchantId,
      stripe_invoice_id: invoice.id,
      stripe_charge_id: ((invoice as unknown as Record<string, unknown>).charge as string) || null,
      end_customer_id: endCustomer.id,
      amount: invoice.amount_due,
      currency: invoice.currency,
      failure_reason: invoice.last_finalization_error?.message || null,
      failed_at: new Date((invoice.created || 0) * 1000).toISOString(),
      status: "open",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create failed_payment:", error);
    return;
  }

  // Emit Inngest event for M3 sequence
  try {
    await inngest.send({
      name: "payment/failed",
      data: {
        failed_payment_id: failedPayment!.id,
        merchant_id: merchantId,
        stripe_invoice_id: invoice.id,
      },
    });
  } catch (err) {
    console.error("Failed to emit Inngest event:", err);
  }
}

async function handlePaymentSucceeded(
  supabase: ReturnType<typeof createServiceClient>,
  event: Stripe.Event
) {
  const invoice = event.data.object as Stripe.Invoice;

  const merchantId = await resolveMerchant(supabase, event.account);
  if (!merchantId) return;

  // Find matching failed_payment
  const { data: failedPayment } = await supabase
    .from("failed_payments")
    .select("id, amount")
    .eq("stripe_invoice_id", invoice.id)
    .eq("merchant_id", merchantId)
    .in("status", ["open", "recovering"])
    .single();

  if (!failedPayment) return;

  // Mark as recovered
  await supabase
    .from("failed_payments")
    .update({ status: "recovered", updated_at: new Date().toISOString() })
    .eq("id", failedPayment.id);

  // Write recovery record
  await supabase.from("recoveries").insert({
    failed_payment_id: failedPayment.id,
    recovered_at: new Date().toISOString(),
    amount_recovered: invoice.amount_paid || failedPayment.amount,
  });

  // Emit Inngest event to cancel pending reminders (M3)
  try {
    await inngest.send({
      name: "payment/recovered",
      data: {
        failed_payment_id: failedPayment.id,
        merchant_id: merchantId,
        stripe_invoice_id: invoice.id,
      },
    });
  } catch (err) {
    console.error("Failed to emit recovery Inngest event:", err);
  }
}

async function resolveMerchant(
  supabase: ReturnType<typeof createServiceClient>,
  stripeAccountId?: string
): Promise<string | null> {
  if (stripeAccountId) {
    const { data } = await supabase
      .from("stripe_connections")
      .select("merchant_id")
      .eq("stripe_account_id", stripeAccountId)
      .eq("status", "active")
      .single();
    return data?.merchant_id || null;
  }

  // Direct event (no event.account) — only resolve if exactly one restricted-key merchant exists
  const { data, count } = await supabase
    .from("stripe_connections")
    .select("merchant_id", { count: "exact" })
    .eq("connection_method", "restricted_key")
    .eq("status", "active");

  if (!data || count === 0) return null;

  if (count && count > 1) {
    console.error(
      `Ambiguous webhook: ${count} restricted-key merchants found. ` +
      `Cannot attribute event without event.account. Skipping.`
    );
    return null;
  }

  return data[0]?.merchant_id || null;
}
