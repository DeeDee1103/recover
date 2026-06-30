import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/format";
import { StatusBadge } from "./status-badge";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: merchant } = await supabase
    .from("merchants")
    .select("id, company_name")
    .eq("auth_user_id", user!.id)
    .single();

  if (!merchant) {
    return <div className="text-zinc-500">Setting up your account...</div>;
  }

  const { data: connection } = await supabase
    .from("stripe_connections")
    .select("stripe_account_id, connection_method, status")
    .eq("merchant_id", merchant.id)
    .eq("status", "active")
    .single();

  // Metrics via targeted counts (no fetch-all)
  const [
    { count: totalFailed },
    { count: recoveredCount },
    { count: openCount },
  ] = await Promise.all([
    supabase.from("failed_payments").select("*", { count: "exact", head: true }).eq("merchant_id", merchant.id),
    supabase.from("failed_payments").select("*", { count: "exact", head: true }).eq("merchant_id", merchant.id).eq("status", "recovered"),
    supabase.from("failed_payments").select("*", { count: "exact", head: true }).eq("merchant_id", merchant.id).in("status", ["open", "recovering"]),
  ]);

  const { data: paymentsWithRecoveries } = await supabase
    .from("failed_payments")
    .select("recoveries(amount_recovered)")
    .eq("merchant_id", merchant.id);

  const total = totalFailed || 0;
  const recovered = recoveredCount || 0;
  const open = openCount || 0;
  const totalRecovered = (paymentsWithRecoveries || []).reduce(
    (sum, p) => sum + ((p.recoveries as unknown as { amount_recovered: number } | null)?.amount_recovered || 0),
    0
  );
  const recoveryRate = total > 0 ? Math.round((recovered / total) * 100) : 0;

  const { data: recentPayments } = await supabase
    .from("failed_payments")
    .select("id, amount, currency, status, failed_at, end_customers(email, name)")
    .eq("merchant_id", merchant.id)
    .order("failed_at", { ascending: false })
    .limit(5);

  return (
    <div>
      <h1 style={{ color: "var(--brand-text)" }} className="text-2xl font-bold">
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

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
        <MetricCard label="Recovered" value={formatCents(totalRecovered)} />
        <MetricCard label="Recovery rate" value={`${recoveryRate}%`} />
        <MetricCard label="Open failures" value={String(open)} />
        <MetricCard label="Total failed" value={String(total)} />
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
          <h2 style={{ color: "var(--brand-text)" }} className="text-lg font-semibold">
            Recent failed payments
          </h2>
          <Link href="/dashboard/payments" style={{ color: "var(--brand-accent)" }} className="text-sm hover:opacity-80">
            View all →
          </Link>
        </div>

        {(!recentPayments || recentPayments.length === 0) ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            No failed payments yet. They&apos;ll appear here once your Stripe webhook is active.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr style={{ borderColor: "var(--brand-primary)" }} className="border-b-2">
                  <th style={{ color: "var(--brand-text)" }} className="pb-2 text-left font-medium">Customer</th>
                  <th style={{ color: "var(--brand-text)" }} className="pb-2 text-left font-medium">Amount</th>
                  <th style={{ color: "var(--brand-text)" }} className="pb-2 text-left font-medium">Status</th>
                  <th style={{ color: "var(--brand-text)" }} className="pb-2 text-left font-medium">Failed</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((p) => (
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
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div style={{ background: "var(--brand-primary)" }} className="h-1" />
      <div className="p-4 sm:p-5">
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
        <p style={{ color: "var(--brand-text)" }} className="mt-1 text-xl sm:text-2xl font-semibold">{value}</p>
      </div>
    </div>
  );
}
