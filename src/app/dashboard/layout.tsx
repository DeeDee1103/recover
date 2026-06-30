import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SignOutButton } from "./sign-out-button";
import { Sidebar } from "./sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: merchant } = await supabase
    .from("merchants")
    .select("company_name, logo_url")
    .eq("auth_user_id", user.id)
    .single();

  return (
    <div className="flex min-h-full">
      <Sidebar
        email={user.email || ""}
        logoUrl={merchant?.logo_url || null}
        companyName={merchant?.company_name || "Recover"}
      >
        <SignOutButton />
      </Sidebar>
      <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8">{children}</main>
    </div>
  );
}
