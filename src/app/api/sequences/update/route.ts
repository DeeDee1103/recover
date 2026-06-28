import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sequence_id, steps } = await request.json();

  if (!sequence_id || !Array.isArray(steps)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  // Verify the sequence belongs to this user's merchant
  const { data: merchant } = await serviceClient
    .from("merchants")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!merchant) {
    return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
  }

  const { data: sequence } = await serviceClient
    .from("sequences")
    .select("id")
    .eq("id", sequence_id)
    .eq("merchant_id", merchant.id)
    .single();

  if (!sequence) {
    return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
  }

  // Update each step
  for (const step of steps) {
    await serviceClient
      .from("sequence_steps")
      .update({
        offset_hours: step.offset_hours,
        subject: step.subject,
        body_template: step.body_template,
        updated_at: new Date().toISOString(),
      })
      .eq("id", step.id)
      .eq("sequence_id", sequence_id);
  }

  return NextResponse.json({ success: true });
}
