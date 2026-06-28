import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="flex min-h-full">
      <nav className="w-56 shrink-0 border-r border-zinc-200 bg-zinc-50 px-4 py-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-8">
          <Link href="/dashboard" className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Recover
          </Link>
        </div>
        <ul className="space-y-1">
          <NavLink href="/dashboard">Dashboard</NavLink>
          <NavLink href="/dashboard/payments">Payments</NavLink>
          <NavLink href="/dashboard/sequences">Sequences</NavLink>
          <NavLink href="/dashboard/settings">Settings</NavLink>
        </ul>
        <div className="mt-auto pt-8 border-t border-zinc-200 dark:border-zinc-800 mt-8">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mb-3">
            {user.email}
          </p>
          <SignOutButton />
        </div>
      </nav>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
      >
        {children}
      </Link>
    </li>
  );
}
