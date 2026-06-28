import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const VALID_TONES = ["professional", "friendly", "urgent", "empathetic"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tone } = await request.json();

  if (!VALID_TONES.includes(tone)) {
    return NextResponse.json({ error: "Invalid tone" }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  await serviceClient
    .from("merchants")
    .update({ tone, updated_at: new Date().toISOString() })
    .eq("auth_user_id", user.id);

  return NextResponse.json({ success: true });
}
