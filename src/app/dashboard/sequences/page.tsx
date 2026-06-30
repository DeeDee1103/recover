import { createClient } from "@/lib/supabase/server";
import { SequenceEditor } from "./sequence-editor";

export default async function SequencesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: merchant } = await supabase
    .from("merchants")
    .select("id, primary_color, accent_color")
    .eq("auth_user_id", user!.id)
    .single();

  if (!merchant) {
    return <div className="text-zinc-500">Setting up your account...</div>;
  }

  const { data: sequences } = await supabase
    .from("sequences")
    .select("id, name, is_active")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: true });

  const activeSequence = sequences?.find((s) => s.is_active) || sequences?.[0];

  const steps = activeSequence
    ? (await supabase
        .from("sequence_steps")
        .select("id, step_order, offset_hours, subject, body_template, channel")
        .eq("sequence_id", activeSequence.id)
        .order("step_order", { ascending: true })
      ).data || []
    : [];

  return (
    <div>
      <h1 style={{ color: "var(--brand-text)" }} className="text-2xl font-bold">
        Sequences
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Configure when and what reminders are sent when a payment fails.
      </p>

      {activeSequence ? (
        <div className="mt-6">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {activeSequence.name}
            </h2>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              activeSequence.is_active
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            }`}>
              {activeSequence.is_active ? "Active" : "Inactive"}
            </span>
          </div>

          <SequenceEditor
            sequenceId={activeSequence.id}
            initialSteps={steps}
            primaryColor={merchant.primary_color || "#112E2A"}
            accentColor={merchant.accent_color || "#C5862F"}
          />
        </div>
      ) : (
        <p className="mt-6 text-sm text-zinc-500">No sequence found. One should have been created on signup.</p>
      )}
    </div>
  );
}
