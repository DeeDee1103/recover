"use client";

export function ConnectButton() {
  return (
    <a
      href="/api/stripe/connect/start"
      className="mt-3 inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
    >
      Connect with Stripe
    </a>
  );
}
