import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

const MAX_STEPS = 20;
const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 5000;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success: allowed } = rateLimit(`sequences:${user.id}`, 20, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
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

  if (steps.length > MAX_STEPS) {
    return NextResponse.json({ error: `Maximum ${MAX_STEPS} steps allowed` }, { status: 400 });
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
    if (step.subject.length > MAX_SUBJECT_LENGTH) {
      validationErrors.push(`Subject at index ${i} exceeds ${MAX_SUBJECT_LENGTH} characters`);
      continue;
    }
    if (step.body_template.length > MAX_BODY_LENGTH) {
      validationErrors.push(`Body template at index ${i} exceeds ${MAX_BODY_LENGTH} characters`);
      continue;
    }
    validSteps.push({
      id: step.id,
      offset_hours: Math.max(0, Math.floor(step.offset_hours)),
      subject: step.subject.slice(0, MAX_SUBJECT_LENGTH),
      body_template: step.body_template.slice(0, MAX_BODY_LENGTH),
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
