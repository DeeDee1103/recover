import { inngest } from "./client";
import { createServiceClient } from "@/lib/supabase/server";
import { getResend } from "@/lib/resend/client";
import { generateReminderCopy } from "@/lib/anthropic/generate-copy";
import { formatAmount, buildUpdateUrl, renderTemplate, buildEmailHtml } from "./helpers";

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
        stripeInvoiceId: payment.stripe_invoice_id,
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
        const updateUrl = buildUpdateUrl(context.stripeInvoiceId);

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

