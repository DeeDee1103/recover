"use client";

import { useRouter } from "next/navigation";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  statusFilter?: string;
}

export function PaginationControls({ currentPage, totalPages, statusFilter }: PaginationControlsProps) {
  const router = useRouter();

  function buildUrl(page: number) {
    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== "all") {
      params.set("status", statusFilter);
    }
    if (page > 1) {
      params.set("page", String(page));
    }
    const qs = params.toString();
    return `/dashboard/payments${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="mt-4 flex items-center justify-between">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Page {currentPage} of {totalPages}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => router.push(buildUrl(currentPage - 1))}
          disabled={currentPage <= 1}
          className="rounded px-3 py-1.5 text-xs font-medium bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        <button
          onClick={() => router.push(buildUrl(currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="rounded px-3 py-1.5 text-xs font-medium bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
