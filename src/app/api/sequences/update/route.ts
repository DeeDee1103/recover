import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sequence_id, steps } = body;

  if (!sequence_id || !Array.isArray(steps)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { data: merchant } = await supabase
    .from("merchants")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!merchant) {
    return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
  }

  const { data: sequence } = await supabase
    .from("sequences")
    .select("id")
    .eq("id", sequence_id)
    .eq("merchant_id", merchant.id)
    .single();

  if (!sequence) {
    return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
  }

  const validationErrors: string[] = [];
  const validSteps = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step.id || typeof step.offset_hours !== "number" || typeof step.subject !== "string" || typeof step.body_template !== "string") {
      validationErrors.push(`Invalid step data at index ${i}`);
      continue;
    }
    validSteps.push({
      id: step.id,
      offset_hours: Math.max(0, Math.floor(step.offset_hours)),
      subject: step.subject,
      body_template: step.body_template,
    });
  }

  if (validationErrors.length > 0) {
    return NextResponse.json({ success: false, errors: validationErrors }, { status: 400 });
  }

  const { error } = await supabase.rpc("batch_update_sequence_steps", {
    p_sequence_id: sequence_id,
    p_steps: validSteps,
  });

  if (error) {
    console.error("Failed to update sequence steps:", error);
    return NextResponse.json({ error: "Failed to update steps" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
