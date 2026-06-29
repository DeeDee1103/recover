import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(`${origin}/dashboard/settings?error=connect_denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/dashboard/settings?error=missing_params`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  let stateData: { user_id: string; nonce?: string };
  try {
    stateData = JSON.parse(Buffer.from(state, "base64url").toString());
  } catch {
    return NextResponse.redirect(`${origin}/dashboard/settings?error=invalid_state`);
  }

  if (stateData.user_id !== user.id) {
    return NextResponse.redirect(`${origin}/dashboard/settings?error=state_mismatch`);
  }

  const cookieStore = await cookies();
  const savedNonce = cookieStore.get("stripe_oauth_nonce")?.value;
  if (!savedNonce || savedNonce !== stateData.nonce) {
    return NextResponse.redirect(`${origin}/dashboard/settings?error=invalid_state`);
  }

  try {
    const response = await getStripe().oauth.token({
      grant_type: "authorization_code",
      code,
    });

    const serviceClient = createServiceClient();

    const { data: merchant } = await serviceClient
      .from("merchants")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!merchant) {
      return NextResponse.redirect(`${origin}/dashboard/settings?error=no_merchant`);
    }

    await serviceClient.from("stripe_connections").upsert(
      {
        merchant_id: merchant.id,
        stripe_account_id: response.stripe_user_id!,
        connection_method: "connect",
        status: "active",
      },
      { onConflict: "merchant_id" }
    );

    return NextResponse.redirect(`${origin}/dashboard/settings?success=connected`);
  } catch (err) {
    console.error("Stripe Connect callback error:", err);
    return NextResponse.redirect(`${origin}/dashboard/settings?error=connect_failed`);
  }
}
