import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/format";
import { StatusBadge } from "../status-badge";
import { PaymentsFilter } from "./payments-filter";
import { PaginationControls } from "./pagination-controls";

interface SearchParams {
  status?: string;
  page?: string;
}

const VALID_STATUSES = ["open", "recovering", "recovered", "lost"];
const PAGE_SIZE = 20;

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: merchant } = await supabase
    .from("merchants")
    .select("id, accent_color")
    .eq("auth_user_id", user!.id)
    .single();

  if (!merchant) {
    return <div className="text-zinc-500">Setting up your account...</div>;
  }

  const currentPage = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;
  const statusFilter = params.status;

  let query = supabase
    .from("failed_payments")
    .select("id, stripe_invoice_id, amount, currency, status, failure_reason, failed_at, end_customers(email, name, stripe_customer_id)", { count: "exact" })
    .eq("merchant_id", merchant.id)
    .order("failed_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (statusFilter && statusFilter !== "all" && VALID_STATUSES.includes(statusFilter)) {
    query = query.eq("status", statusFilter as "open" | "recovering" | "recovered" | "lost");
  }

  const { data: payments, count: totalCount } = await query;

  const totalPages = Math.ceil((totalCount || 0) / PAGE_SIZE);

  // Status counts via targeted count queries (no fetch-all)
  const [
    { count: allCount },
    { count: openCt },
    { count: recoveringCt },
    { count: recoveredCt },
    { count: lostCt },
  ] = await Promise.all([
    supabase.from("failed_payments").select("*", { count: "exact", head: true }).eq("merchant_id", merchant.id),
    supabase.from("failed_payments").select("*", { count: "exact", head: true }).eq("merchant_id", merchant.id).eq("status", "open"),
    supabase.from("failed_payments").select("*", { count: "exact", head: true }).eq("merchant_id", merchant.id).eq("status", "recovering"),
    supabase.from("failed_payments").select("*", { count: "exact", head: true }).eq("merchant_id", merchant.id).eq("status", "recovered"),
    supabase.from("failed_payments").select("*", { count: "exact", head: true }).eq("merchant_id", merchant.id).eq("status", "lost"),
  ]);

  const counts = {
    all: allCount || 0,
    open: openCt || 0,
    recovering: recoveringCt || 0,
    recovered: recoveredCt || 0,
    lost: lostCt || 0,
  };

  const accentColor = merchant.accent_color || "#C5862F";

  return (
    <div>
      <h1 style={{ color: "var(--brand-text)" }} className="text-2xl font-bold">
        Failed Payments
      </h1>

      <PaymentsFilter current={statusFilter || "all"} counts={counts} accentColor={accentColor} />

      {(!payments || payments.length === 0) ? (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          No payments found{statusFilter && statusFilter !== "all" ? ` with status "${statusFilter}"` : ""}.
        </p>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr style={{ borderColor: "var(--brand-primary)" }} className="border-b-2">
                  <th style={{ color: "var(--brand-text)" }} className="pb-2 text-left font-medium">Customer</th>
                  <th style={{ color: "var(--brand-text)" }} className="pb-2 text-left font-medium">Amount</th>
                  <th style={{ color: "var(--brand-text)" }} className="pb-2 text-left font-medium">Status</th>
                  <th style={{ color: "var(--brand-text)" }} className="pb-2 text-left font-medium">Reason</th>
                  <th style={{ color: "var(--brand-text)" }} className="pb-2 text-left font-medium">Failed</th>
                  <th style={{ color: "var(--brand-text)" }} className="pb-2 text-left font-medium">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
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

          {totalPages > 1 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              statusFilter={statusFilter}
            />
          )}
        </>
      )}
    </div>
  );
}
