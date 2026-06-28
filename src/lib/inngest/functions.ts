import { inngest } from "./client";
import { createServiceClient } from "@/lib/supabase/server";
import { getResend } from "@/lib/resend/client";
import { generateReminderCopy } from "@/lib/anthropic/generate-copy";

export const reminderSequence = inngest.createFunction(
  {
    id: "reminder-sequence",
    triggers: [{ event: "payment/failed" }],
    cancelOn: [
      {
        event: "payment/recovered",
        match: "data.failed_payment_id",
      },
    ],
  },
  async ({ event, step }) => {
    const { failed_payment_id, merchant_id } = event.data;

    // Load sequence steps
    const steps = await step.run("load-sequence-steps", async () => {
      const supabase = createServiceClient();

      const { data: sequence } = await supabase
        .from("sequences")
        .select("id")
        .eq("merchant_id", merchant_id)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      if (!sequence) return [];

      const { data: sequenceSteps } = await supabase
        .from("sequence_steps")
        .select("*")
        .eq("sequence_id", sequence.id)
        .order("step_order", { ascending: true });

      return sequenceSteps || [];
    });

    if (!steps.length) return { status: "no_sequence" };

    // Load payment and customer info
    const context = await step.run("load-context", async () => {
      const supabase = createServiceClient();

      const { data: payment } = await supabase
        .from("failed_payments")
        .select("*, end_customers(*)")
        .eq("id", failed_payment_id)
        .single();

      if (!payment) return null;

      const { data: merchant } = await supabase
        .from("merchants")
        .select("company_name, tone")
        .eq("id", merchant_id)
        .single();

      const { data: connection } = await supabase
        .from("stripe_connections")
        .select("stripe_account_id")
        .eq("merchant_id", merchant_id)
        .eq("status", "active")
        .single();

      return {
        payment,
        customer: payment.end_customers,
        merchantName: merchant?.company_name || "Our Team",
        tone: merchant?.tone || "professional",
        stripeAccountId: connection?.stripe_account_id,
      };
    });

    if (!context) return { status: "payment_not_found" };

    // Update status to recovering
    await step.run("mark-recovering", async () => {
      const supabase = createServiceClient();
      await supabase
        .from("failed_payments")
        .update({ status: "recovering", updated_at: new Date().toISOString() })
        .eq("id", failed_payment_id);
    });

    // Execute each step in the sequence
    for (const seqStep of steps) {
      if (seqStep.offset_hours > 0) {
        await step.sleep(
          `wait-step-${seqStep.step_order}`,
          `${seqStep.offset_hours}h`
        );
      }

      const stillOpen = await step.run(
        `check-status-step-${seqStep.step_order}`,
        async () => {
          const supabase = createServiceClient();
          const { data } = await supabase
            .from("failed_payments")
            .select("status")
            .eq("id", failed_payment_id)
            .single();

          return data?.status === "open" || data?.status === "recovering";
        }
      );

      if (!stillOpen) {
        return { status: "recovered_during_sequence" };
      }

      await step.run(`send-step-${seqStep.step_order}`, async () => {
        const supabase = createServiceClient();
        const resend = getResend();

        const customerEmail = context.customer?.email;
        if (!customerEmail) {
          await supabase.from("reminders").insert({
            failed_payment_id,
            step_order: seqStep.step_order,
            channel: "email",
            scheduled_at: new Date().toISOString(),
            status: "cancelled",
          });
          return { skipped: true, reason: "no_email" };
        }

        const amount = formatAmount(context.payment.amount, context.payment.currency);
        const updateUrl = buildUpdateUrl(context.stripeAccountId, context.customer?.stripe_customer_id);

        let subject: string;
        let body: string;
        let usedAi = false;

        try {
          const aiCopy = await generateReminderCopy({
            customerName: context.customer?.name || "there",
            amount,
            currency: context.payment.currency.toUpperCase(),
            companyName: context.merchantName,
            tone: context.tone,
            stepNumber: seqStep.step_order,
            totalSteps: steps.length,
            updateUrl,
          });
          subject = aiCopy.subject;
          body = aiCopy.body;
          usedAi = true;
        } catch (aiErr) {
          console.warn(`AI copy failed for step ${seqStep.step_order}, using template:`, aiErr);
          subject = renderTemplate(seqStep.subject, {
            customer_name: context.customer?.name || "there",
            amount,
            currency: context.payment.currency.toUpperCase(),
          });
          body = renderTemplate(seqStep.body_template, {
            customer_name: context.customer?.name || "there",
            amount,
            currency: context.payment.currency.toUpperCase(),
            update_url: updateUrl,
            company_name: context.merchantName,
          });
        }

        try {
          const { data: emailResult } = await resend.emails.send({
            from: `${context.merchantName} <recover@updates.recover-app.com>`,
            to: [customerEmail],
            subject,
            html: buildEmailHtml(body, updateUrl, context.merchantName),
          });

          await supabase.from("reminders").insert({
            failed_payment_id,
            step_order: seqStep.step_order,
            channel: "email",
            scheduled_at: new Date().toISOString(),
            sent_at: new Date().toISOString(),
            status: "sent",
            provider_message_id: emailResult?.id || null,
          });

          return { sent: true, message_id: emailResult?.id, ai_generated: usedAi };
        } catch (err) {
          console.error(`Failed to send step ${seqStep.step_order}:`, err);

          await supabase.from("reminders").insert({
            failed_payment_id,
            step_order: seqStep.step_order,
            channel: "email",
            scheduled_at: new Date().toISOString(),
            status: "cancelled",
          });

          return { sent: false, error: String(err) };
        }
      });
    }

    return { status: "sequence_complete" };
  }
);

function formatAmount(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

function buildUpdateUrl(stripeAccountId?: string, customerId?: string): string {
  if (stripeAccountId && customerId) {
    return `https://billing.stripe.com/p/login/${stripeAccountId}`;
  }
  return "#";
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || "");
}

function buildEmailHtml(body: string, updateUrl: string, companyName: string): string {
  const bodyHtml = body
    .split("\n")
    .map((line) => (line.trim() === "" ? "<br/>" : `<p style="margin:0 0 12px;color:#333;font-size:16px;line-height:1.5;">${line}</p>`))
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#112E2A;padding:24px 32px;">
      <span style="color:#C5862F;font-weight:700;font-size:20px;">${companyName}</span>
    </div>
    <div style="padding:32px;">
      ${bodyHtml}
      <div style="margin:28px 0;">
        <a href="${updateUrl}" style="display:inline-block;background:#C5862F;color:#fff;font-weight:700;font-size:16px;padding:14px 28px;border-radius:8px;text-decoration:none;">Update payment method</a>
      </div>
      <p style="margin:24px 0 0;font-size:13px;color:#888;">
        If you've already updated your payment method, please disregard this email.
      </p>
    </div>
  </div>
</body>
</html>`;
}
