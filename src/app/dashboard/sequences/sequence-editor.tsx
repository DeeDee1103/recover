"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Step {
  id: string;
  step_order: number;
  offset_hours: number;
  subject: string;
  body_template: string;
  channel: string;
}

export function SequenceEditor({ sequenceId, initialSteps }: { sequenceId: string; initialSteps: Step[] }) {
  const [steps, setSteps] = useState(initialSteps);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function updateStep(index: number, field: keyof Step, value: string | number) {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const res = await fetch("/api/sequences/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sequence_id: sequenceId, steps }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to save");
    } else {
      setSaved(true);
      router.refresh();
    }
    setSaving(false);
  }

  return (
    <div className="mt-6 space-y-4">
      {steps.map((step, i) => (
        <div
          key={step.id}
          className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Step {step.step_order}
            </h3>
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-500 dark:text-zinc-400">
                Send after
              </label>
              <input
                type="number"
                min={0}
                value={step.offset_hours}
                onChange={(e) => updateStep(i, "offset_hours", parseInt(e.target.value) || 0)}
                className="w-16 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <span className="text-xs text-zinc-500 dark:text-zinc-400">hours</span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                Subject
              </label>
              <input
                type="text"
                value={step.subject}
                onChange={(e) => updateStep(i, "subject", e.target.value)}
                className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                Body template
              </label>
              <textarea
                rows={4}
                value={step.body_template}
                onChange={(e) => updateStep(i, "body_template", e.target.value)}
                className="w-full rounded border border-zinc-300 px-3 py-2 text-sm font-mono dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <p className="mt-1 text-xs text-zinc-400">
                Variables: {"{{customer_name}}"}, {"{{amount}}"}, {"{{currency}}"}, {"{{update_url}}"}, {"{{company_name}}"}
              </p>
            </div>
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {saved && <span className="text-sm text-green-600 dark:text-green-400">Saved!</span>}
        {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
      </div>
    </div>
  );
}
