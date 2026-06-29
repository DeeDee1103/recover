import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

const VALID_TONES = ["professional", "friendly", "urgent", "empathetic"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success: allowed } = rateLimit(`tone:${user.id}`, 10, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { tone } = body;

  if (!VALID_TONES.includes(tone)) {
    return NextResponse.json({ error: "Invalid tone" }, { status: 400 });
  }

  const { error } = await supabase
    .from("merchants")
    .update({ tone, updated_at: new Date().toISOString() })
    .eq("auth_user_id", user.id);

  if (error) {
    console.error("Failed to update tone:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
