import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { rateLimit } from "@/lib/rate-limit";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success: allowed } = rateLimit(`connect-start:${user.id}`, 10, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "Stripe Connect is not configured. Use the restricted key fallback in Settings." },
      { status: 400 }
    );
  }

  const nonce = randomUUID();
  const state = Buffer.from(JSON.stringify({ user_id: user.id, nonce })).toString("base64url");
  const redirectUri = `${process.env.APP_URL}/api/stripe/connect/callback`;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "read_write",
    redirect_uri: redirectUri,
    state,
  });

  const response = NextResponse.redirect(
    `https://connect.stripe.com/oauth/authorize?${params.toString()}`
  );

  response.cookies.set("stripe_oauth_nonce", nonce, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/api/stripe/connect/callback",
  });

  return response;
}
