export function StatusBadge({ status }: { status: string }) {
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
