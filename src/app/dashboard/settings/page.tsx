import { createClient } from "@/lib/supabase/server";
import { ConnectButton } from "./connect-button";
import { RestrictedKeyForm } from "./restricted-key-form";
import { ToneSelector } from "./tone-selector";
import { BrandingEditor } from "./branding-editor";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: merchant } = await supabase
    .from("merchants")
    .select("id, tone, company_name, logo_url, primary_color, accent_color, email_footer_text")
    .eq("auth_user_id", user!.id)
    .single();

  const { data: connection } = merchant
    ? await supabase
        .from("stripe_connections")
        .select("stripe_account_id, connection_method, status")
        .eq("merchant_id", merchant.id)
        .eq("status", "active")
        .single()
    : { data: null };

  const hasConnectClientId = !!process.env.STRIPE_CONNECT_CLIENT_ID;

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Settings
      </h1>

      <section className="mt-8 max-w-lg">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Branding
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Customize your logo, colors, and company name. These appear on recovery emails sent to your customers.
        </p>
        <div className="mt-4">
          <BrandingEditor
            companyName={merchant?.company_name || ""}
            logoUrl={merchant?.logo_url || null}
            primaryColor={merchant?.primary_color || "#112E2A"}
            accentColor={merchant?.accent_color || "#C5862F"}
            emailFooterText={merchant?.email_footer_text || ""}
          />
        </div>
      </section>

      <section className="mt-8 max-w-lg">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          AI Email Tone
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Choose the tone for AI-generated reminder emails. The AI personalizes each email based on the customer and payment context.
        </p>
        <div className="mt-4">
          <ToneSelector currentTone={merchant?.tone || "professional"} />
        </div>
      </section>

      <section className="mt-8 max-w-lg">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Stripe Connection
        </h2>

        {connection ? (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              Connected
            </p>
            <p className="mt-1 text-sm text-green-700 dark:text-green-300">
              Account: {connection.stripe_account_id}
            </p>
            <p className="text-sm text-green-700 dark:text-green-300">
              Method: {connection.connection_method}
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-6">
            {hasConnectClientId && (
              <div>
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-200">
                  Option 1: Stripe Connect (recommended)
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Securely connect your Stripe account via OAuth.
                </p>
                <ConnectButton />
              </div>
            )}

            <div>
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-200">
                {hasConnectClientId ? "Option 2: " : ""}Restricted API Key
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Paste a Stripe restricted API key for testing. Create one in your{" "}
                <a
                  href="https://dashboard.stripe.com/test/apikeys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Stripe Dashboard
                </a>{" "}
                with read access to charges, invoices, and customers.
              </p>
              <RestrictedKeyForm />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
