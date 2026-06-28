export default function PaymentsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Failed Payments
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Failed payments will appear here once your Stripe account is connected and webhooks are configured.
      </p>
    </div>
  );
}
