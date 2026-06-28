"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TONES = [
  { value: "professional", label: "Professional", description: "Business-appropriate, respectful, clear about urgency" },
  { value: "friendly", label: "Friendly", description: "Warm, conversational, like a helpful friend" },
  { value: "urgent", label: "Urgent", description: "Direct, action-needed, without being aggressive" },
  { value: "empathetic", label: "Empathetic", description: "Understanding, acknowledges payment issues happen" },
] as const;

export function ToneSelector({ currentTone }: { currentTone: string }) {
  const [tone, setTone] = useState(currentTone);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/settings/tone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tone }),
    });
    if (res.ok) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  return (
    <div className="space-y-3">
      {TONES.map((t) => (
        <label
          key={t.value}
          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
            tone === t.value
              ? "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950"
              : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
          }`}
        >
          <input
            type="radio"
            name="tone"
            value={t.value}
            checked={tone === t.value}
            onChange={() => { setTone(t.value); setSaved(false); }}
            className="mt-1"
          />
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t.label}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t.description}</p>
          </div>
        </label>
      ))}

      {tone !== currentTone && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save tone"}
        </button>
      )}
      {saved && <span className="ml-3 text-sm text-green-600 dark:text-green-400">Saved!</span>}
    </div>
  );
}
