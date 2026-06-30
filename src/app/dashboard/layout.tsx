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
    .select("company_name, logo_url, primary_color, accent_color, text_color")
    .eq("auth_user_id", user.id)
    .single();

  const brandVars = {
    "--brand-primary": merchant?.primary_color || "#112E2A",
    "--brand-accent": merchant?.accent_color || "#C5862F",
    "--brand-text": merchant?.text_color || "#000000",
  } as React.CSSProperties;

  return (
    <div className="flex min-h-full">
      <Sidebar
        email={user.email || ""}
        logoUrl={merchant?.logo_url || null}
        companyName={merchant?.company_name || "Recover"}
      >
        <SignOutButton />
      </Sidebar>
      <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8" style={brandVars}>{children}</main>
    </div>
  );
}
