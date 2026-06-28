import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const serviceClient = createServiceClient();
  const { data: merchant } = await serviceClient
    .from("merchants")
    .select("id, company_name")
    .eq("auth_user_id", user!.id)
    .single();

  const { data: connection } = merchant
    ? await serviceClient
        .from("stripe_connections")
        .select("stripe_account_id, connection_method, status")
        .eq("merchant_id", merchant.id)
        .eq("status", "active")
        .single()
    : { data: null };

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Dashboard
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {merchant?.company_name || "Welcome to Recover"}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <MetricCard label="Recovered" value="$0" />
        <MetricCard label="Recovery rate" value="0%" />
        <MetricCard label="Open failures" value="0" />
      </div>

      {!connection && (
        <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            Connect your Stripe account
          </h3>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
            To start recovering failed payments, connect your Stripe account in{" "}
            <Link href="/dashboard/settings" className="underline font-medium">
              Settings
            </Link>
            .
          </p>
        </div>
      )}

      {connection && (
        <div className="mt-8 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
          <h3 className="text-sm font-semibold text-green-800 dark:text-green-200">
            Stripe connected
          </h3>
          <p className="mt-1 text-sm text-green-700 dark:text-green-300">
            Account {connection.stripe_account_id} ({connection.connection_method})
          </p>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
    </div>
  );
}
