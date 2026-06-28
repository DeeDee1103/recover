import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      await provisionMerchant(data.user.id, data.user.user_metadata?.company_name);
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}

async function provisionMerchant(authUserId: string, companyName?: string) {
  const serviceClient = createServiceClient();

  const { data: existing } = await serviceClient
    .from("merchants")
    .select("id")
    .eq("auth_user_id", authUserId)
    .single();

  if (existing) return;

  const { data: merchant, error: merchantError } = await serviceClient
    .from("merchants")
    .insert({ auth_user_id: authUserId, company_name: companyName || null })
    .select("id")
    .single();

  if (merchantError || !merchant) return;

  const { data: sequence } = await serviceClient
    .from("sequences")
    .insert({
      merchant_id: merchant.id,
      name: "Default Recovery Sequence",
      is_active: true,
    })
    .select("id")
    .single();

  if (!sequence) return;

  await serviceClient.from("sequence_steps").insert([
    {
      sequence_id: sequence.id,
      step_order: 1,
      offset_hours: 0,
      subject: "Action required: update your payment method",
      body_template:
        "Hi {{customer_name}},\n\nYour recent payment of {{amount}} {{currency}} failed. Please update your payment method to keep your subscription active.\n\n{{update_url}}",
      channel: "email",
    },
    {
      sequence_id: sequence.id,
      step_order: 2,
      offset_hours: 72,
      subject: "Reminder: your payment still needs attention",
      body_template:
        "Hi {{customer_name}},\n\nThis is a friendly reminder that your payment of {{amount}} {{currency}} is still outstanding. Please update your payment method at your earliest convenience.\n\n{{update_url}}",
      channel: "email",
    },
    {
      sequence_id: sequence.id,
      step_order: 3,
      offset_hours: 120,
      subject: "Your subscription is at risk",
      body_template:
        "Hi {{customer_name}},\n\nWe haven't been able to process your payment of {{amount}} {{currency}}. Your subscription may be cancelled if we can't collect payment soon.\n\n{{update_url}}",
      channel: "email",
    },
    {
      sequence_id: sequence.id,
      step_order: 4,
      offset_hours: 168,
      subject: "Final notice: payment required",
      body_template:
        "Hi {{customer_name}},\n\nThis is our final reminder about your outstanding payment of {{amount}} {{currency}}. Please update your payment method to avoid losing access.\n\n{{update_url}}",
      channel: "email",
    },
  ]);
}
