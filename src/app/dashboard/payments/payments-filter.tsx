"use client";

import { useRouter } from "next/navigation";

interface PaymentsFilterProps {
  current: string;
  counts: Record<string, number>;
}

const FILTERS = ["all", "open", "recovering", "recovered", "lost"] as const;

export function PaymentsFilter({ current, counts }: PaymentsFilterProps) {
  const router = useRouter();

  return (
    <div className="mt-4 flex gap-2 flex-wrap">
      {FILTERS.map((f) => (
        <button
          key={f}
          onClick={() => router.push(f === "all" ? "/dashboard/payments" : `/dashboard/payments?status=${f}`)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            current === f
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
          }`}
        >
          {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f] || 0})
        </button>
      ))}
    </div>
  );
}
