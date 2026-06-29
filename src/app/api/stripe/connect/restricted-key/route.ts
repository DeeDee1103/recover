import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { encrypt } from "@/lib/crypto/encrypt";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success: allowed } = rateLimit(`restricted-key:${user.id}`, 5, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { api_key } = body;

  if (!api_key || typeof api_key !== "string") {
    return NextResponse.json({ error: "API key is required" }, { status: 400 });
  }

  try {
    const testStripe = new Stripe(api_key, {
      apiVersion: "2026-06-24.dahlia",
    });
    await testStripe.balance.retrieve();
    let stripeAccountId: string;
    try {
      // Restricted keys with account read permission can retrieve their own account
      const acct = await testStripe.accounts.retrieve("me" as string);
      stripeAccountId = acct.id;
    } catch {
      // If account read is not permitted, derive a deterministic ID from the key
      // This is a fallback — merchants should grant account read permission
      const keyHash = api_key.slice(-8);
      stripeAccountId = `acct_rk_${user.id.slice(0, 8)}_${keyHash}`;
    }

    const serviceClient = createServiceClient();

    const { data: merchant } = await serviceClient
      .from("merchants")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!merchant) {
      return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
    }

    const encryptedKey = encrypt(api_key);

    await serviceClient.from("stripe_connections").upsert(
      {
        merchant_id: merchant.id,
        stripe_account_id: stripeAccountId,
        connection_method: "restricted_key",
        restricted_key_encrypted: encryptedKey,
        status: "active",
      },
      { onConflict: "merchant_id" }
    );

    return NextResponse.json({ success: true, account_id: stripeAccountId });
  } catch (err) {
    console.error("Restricted key validation error:", err);
    return NextResponse.json(
      { error: "Invalid API key — could not reach Stripe" },
      { status: 400 }
    );
  }
}
