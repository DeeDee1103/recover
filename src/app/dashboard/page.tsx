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

  if (!merchant) {
    return <div className="text-zinc-500">Setting up your account...</div>;
  }

  const { data: connection } = await serviceClient
    .from("stripe_connections")
    .select("stripe_account_id, connection_method, status")
    .eq("merchant_id", merchant.id)
    .eq("status", "active")
    .single();

  // Metrics
  const { data: allPayments } = await serviceClient
    .from("failed_payments")
    .select("id, status, amount, currency")
    .eq("merchant_id", merchant.id);

  const { data: recoveries } = await serviceClient
    .from("recoveries")
    .select("amount_recovered, failed_payment_id")
    .in(
      "failed_payment_id",
      (allPayments || []).map((p) => p.id)
    );

  const totalFailed = allPayments?.length || 0;
  const recoveredCount = allPayments?.filter((p) => p.status === "recovered").length || 0;
  const openCount = allPayments?.filter((p) => p.status === "open" || p.status === "recovering").length || 0;
  const totalRecovered = (recoveries || []).reduce((sum, r) => sum + r.amount_recovered, 0);
  const recoveryRate = totalFailed > 0 ? Math.round((recoveredCount / totalFailed) * 100) : 0;

  const { data: recentPayments } = await serviceClient
    .from("failed_payments")
    .select("id, amount, currency, status, failed_at, end_customers(email, name)")
    .eq("merchant_id", merchant.id)
    .order("failed_at", { ascending: false })
    .limit(5);

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Dashboard
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {merchant.company_name || "Welcome to Recover"}
      </p>

      {!connection && (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            Connect your Stripe account
          </h3>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
            To start recovering failed payments, connect your Stripe account in{" "}
            <Link href="/dashboard/settings" className="underline font-medium">Settings</Link>.
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <MetricCard label="Recovered" value={formatCents(totalRecovered)} />
        <MetricCard label="Recovery rate" value={`${recoveryRate}%`} />
        <MetricCard label="Open failures" value={String(openCount)} />
        <MetricCard label="Total failed" value={String(totalFailed)} />
      </div>

      {connection && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-800 dark:bg-green-950">
          <p className="text-sm text-green-700 dark:text-green-300">
            Stripe connected: {connection.stripe_account_id} ({connection.connection_method})
          </p>
        </div>
      )}

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Recent failed payments
          </h2>
          <Link href="/dashboard/payments" className="text-sm text-indigo-600 hover:text-indigo-500">
            View all →
          </Link>
        </div>

        {(!recentPayments || recentPayments.length === 0) ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            No failed payments yet. They&apos;ll appear here once your Stripe webhook is active.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="pb-2 text-left font-medium text-zinc-500 dark:text-zinc-400">Customer</th>
                  <th className="pb-2 text-left font-medium text-zinc-500 dark:text-zinc-400">Amount</th>
                  <th className="pb-2 text-left font-medium text-zinc-500 dark:text-zinc-400">Status</th>
                  <th className="pb-2 text-left font-medium text-zinc-500 dark:text-zinc-400">Failed</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((p: any) => (
                  <tr key={p.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="py-3 text-zinc-900 dark:text-zinc-100">
                      {p.end_customers?.name || p.end_customers?.email || "Unknown"}
                    </td>
                    <td className="py-3 text-zinc-900 dark:text-zinc-100">
                      {formatCents(p.amount, p.currency)}
                    </td>
                    <td className="py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="py-3 text-zinc-500 dark:text-zinc-400">
                      {new Date(p.failed_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    recovering: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    recovered: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    lost: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || styles.open}`}>
      {status}
    </span>
  );
}

function formatCents(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}
