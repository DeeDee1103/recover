import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const MAX_FOOTER_LENGTH = 500;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success: allowed } = rateLimit(`branding:${user.id}`, 10, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { company_name, primary_color, accent_color, text_color, email_footer_text } = body;

  if (company_name !== undefined && typeof company_name !== "string") {
    return NextResponse.json({ error: "Invalid company_name" }, { status: 400 });
  }
  if (company_name && company_name.length > 100) {
    return NextResponse.json({ error: "Company name too long" }, { status: 400 });
  }

  if (primary_color !== undefined && !HEX_COLOR_RE.test(primary_color)) {
    return NextResponse.json({ error: "Invalid primary_color (use #RRGGBB)" }, { status: 400 });
  }
  if (accent_color !== undefined && !HEX_COLOR_RE.test(accent_color)) {
    return NextResponse.json({ error: "Invalid accent_color (use #RRGGBB)" }, { status: 400 });
  }
  if (text_color !== undefined && !HEX_COLOR_RE.test(text_color)) {
    return NextResponse.json({ error: "Invalid text_color (use #RRGGBB)" }, { status: 400 });
  }

  if (email_footer_text !== undefined && typeof email_footer_text !== "string") {
    return NextResponse.json({ error: "Invalid email_footer_text" }, { status: 400 });
  }
  if (email_footer_text && email_footer_text.length > MAX_FOOTER_LENGTH) {
    return NextResponse.json({ error: "Footer text too long" }, { status: 400 });
  }

  const { error } = await supabase
    .from("merchants")
    .update({
      updated_at: new Date().toISOString(),
      ...(company_name !== undefined && { company_name }),
      ...(primary_color !== undefined && { primary_color }),
      ...(accent_color !== undefined && { accent_color }),
      ...(text_color !== undefined && { text_color }),
      ...(email_footer_text !== undefined && { email_footer_text }),
    })
    .eq("auth_user_id", user.id);

  if (error) {
    console.error("Failed to update branding:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
