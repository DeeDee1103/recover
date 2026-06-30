import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success: allowed } = rateLimit(`logo:${user.id}`, 5, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { data: merchant } = await supabase
    .from("merchants")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!merchant) {
    return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("logo") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Invalid file type. Use PNG, JPEG, WebP, or SVG." }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 2MB)" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "png";
  const path = `${merchant.id}/logo.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("logos")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    console.error("Logo upload error:", uploadError);
    return NextResponse.json({ error: "Failed to upload" }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("merchants")
    .update({ logo_url: urlData.publicUrl, updated_at: new Date().toISOString() })
    .eq("id", merchant.id);

  if (updateError) {
    console.error("Failed to update logo_url:", updateError);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ success: true, logo_url: urlData.publicUrl });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: merchant } = await supabase
    .from("merchants")
    .select("id, logo_url")
    .eq("auth_user_id", user.id)
    .single();

  if (!merchant || !merchant.logo_url) {
    return NextResponse.json({ error: "No logo to remove" }, { status: 404 });
  }

  const url = new URL(merchant.logo_url);
  const storagePath = url.pathname.split("/logos/").pop();
  if (storagePath) {
    await supabase.storage.from("logos").remove([storagePath]);
  }

  await supabase
    .from("merchants")
    .update({ logo_url: null, updated_at: new Date().toISOString() })
    .eq("id", merchant.id);

  return NextResponse.json({ success: true });
}
