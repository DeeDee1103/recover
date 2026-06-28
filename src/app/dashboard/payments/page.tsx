import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { PaymentsFilter } from "./payments-filter";

interface SearchParams {
  status?: string;
}

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const serviceClient = createServiceClient();
  const { data: merchant } = await serviceClient
    .from("merchants")
    .select("id")
    .eq("auth_user_id", user!.id)
    .single();

  if (!merchant) {
    return <div className="text-zinc-500">Setting up your account...</div>;
  }

  let query = serviceClient
    .from("failed_payments")
    .select("id, stripe_invoice_id, amount, currency, status, failure_reason, failed_at, end_customers(email, name, stripe_customer_id)")
    .eq("merchant_id", merchant.id)
    .order("failed_at", { ascending: false });

  const statusFilter = params.status;
  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data: payments } = await query;

  // Count by status
  const { data: allPayments } = await serviceClient
    .from("failed_payments")
    .select("status")
    .eq("merchant_id", merchant.id);

  const counts = {
    all: allPayments?.length || 0,
    open: allPayments?.filter((p) => p.status === "open").length || 0,
    recovering: allPayments?.filter((p) => p.status === "recovering").length || 0,
    recovered: allPayments?.filter((p) => p.status === "recovered").length || 0,
    lost: allPayments?.filter((p) => p.status === "lost").length || 0,
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Failed Payments
      </h1>

      <PaymentsFilter current={statusFilter || "all"} counts={counts} />

      {(!payments || payments.length === 0) ? (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          No payments found{statusFilter && statusFilter !== "all" ? ` with status "${statusFilter}"` : ""}.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="pb-2 text-left font-medium text-zinc-500 dark:text-zinc-400">Customer</th>
                <th className="pb-2 text-left font-medium text-zinc-500 dark:text-zinc-400">Amount</th>
                <th className="pb-2 text-left font-medium text-zinc-500 dark:text-zinc-400">Status</th>
                <th className="pb-2 text-left font-medium text-zinc-500 dark:text-zinc-400">Reason</th>
                <th className="pb-2 text-left font-medium text-zinc-500 dark:text-zinc-400">Failed</th>
                <th className="pb-2 text-left font-medium text-zinc-500 dark:text-zinc-400">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p: any) => (
                <tr key={p.id} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-3 text-zinc-900 dark:text-zinc-100">
                    <div>{p.end_customers?.name || "Unknown"}</div>
                    <div className="text-xs text-zinc-500">{p.end_customers?.email}</div>
                  </td>
                  <td className="py-3 text-zinc-900 dark:text-zinc-100">
                    {formatCents(p.amount, p.currency)}
                  </td>
                  <td className="py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="py-3 text-zinc-500 dark:text-zinc-400 max-w-[200px] truncate">
                    {p.failure_reason || "—"}
                  </td>
                  <td className="py-3 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                    {new Date(p.failed_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 text-zinc-500 dark:text-zinc-400 text-xs font-mono">
                    {p.stripe_invoice_id ? p.stripe_invoice_id.slice(0, 20) + "…" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
