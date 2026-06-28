import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import Stripe from "stripe";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { api_key } = await request.json();

  if (!api_key || typeof api_key !== "string") {
    return NextResponse.json({ error: "API key is required" }, { status: 400 });
  }

  try {
    const testStripe = new Stripe(api_key, {
      apiVersion: "2026-06-24.dahlia",
    });
    const balance = await testStripe.balance.retrieve();
    const account = { id: `acct_restricted_${user.id.slice(0, 8)}` };

    const serviceClient = createServiceClient();

    const { data: merchant } = await serviceClient
      .from("merchants")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!merchant) {
      return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
    }

    await serviceClient.from("stripe_connections").upsert(
      {
        merchant_id: merchant.id,
        stripe_account_id: account.id,
        connection_method: "restricted_key",
        status: "active",
      },
      { onConflict: "merchant_id" }
    );

    return NextResponse.json({ success: true, account_id: account.id });
  } catch (err) {
    console.error("Restricted key validation error:", err);
    return NextResponse.json(
      { error: "Invalid API key — could not reach Stripe" },
      { status: 400 }
    );
  }
}
