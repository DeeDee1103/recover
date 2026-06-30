"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

const TONES = [
  { value: "professional", label: "Professional", description: "Business-appropriate, respectful, clear about urgency" },
  { value: "friendly", label: "Friendly", description: "Warm, conversational, like a helpful friend" },
  { value: "urgent", label: "Urgent", description: "Direct, action-needed, without being aggressive" },
  { value: "empathetic", label: "Empathetic", description: "Understanding, acknowledges payment issues happen" },
] as const;

const SAMPLE_EMAILS: Record<string, { greeting: string; body: string; closing: string }> = {
  professional: {
    greeting: "Dear Sarah,",
    body: "We're writing to inform you that your recent payment of $49.99 USD was unsuccessful. This may be due to an expired card, insufficient funds, or a temporary bank hold.",
    closing: "Please update your payment method at your earliest convenience using the link below.",
  },
  friendly: {
    greeting: "Hey Sarah! 👋",
    body: "Just a quick heads-up — your payment of $49.99 USD didn't go through. No worries, these things happen! It could be an expired card or a temporary hiccup with your bank.",
    closing: "You can sort it out in just a sec by clicking the button below. Easy peasy!",
  },
  urgent: {
    greeting: "Hi Sarah,",
    body: "Your payment of $49.99 USD has failed. To avoid any service interruption, please update your payment method as soon as possible.",
    closing: "Click below to resolve this now — it only takes a moment.",
  },
  empathetic: {
    greeting: "Hi Sarah,",
    body: "We understand that payment issues can be frustrating, and we want to make this as easy as possible for you. Your recent payment of $49.99 USD wasn't able to be processed — this can happen for many reasons and is nothing to worry about.",
    closing: "Whenever you have a moment, you can update your payment details using the button below. We're here if you need any help.",
  },
};

interface BrandingEditorProps {
  companyName: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  textColor: string;
  emailFooterText: string;
  currentTone: string;
}

export function BrandingEditor({
  companyName: initialName,
  logoUrl: initialLogo,
  primaryColor: initialPrimary,
  accentColor: initialAccent,
  textColor: initialText,
  emailFooterText: initialFooter,
  currentTone: initialTone,
}: BrandingEditorProps) {
  const [companyName, setCompanyName] = useState(initialName);
  const [primaryColor, setPrimaryColor] = useState(initialPrimary);
  const [accentColor, setAccentColor] = useState(initialAccent);
  const [textColor, setTextColor] = useState(initialText);
  const [emailFooterText, setEmailFooterText] = useState(initialFooter);
  const [logoUrl, setLogoUrl] = useState(initialLogo);
  const [tone, setTone] = useState(initialTone);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const hasChanges =
    companyName !== initialName ||
    primaryColor !== initialPrimary ||
    accentColor !== initialAccent ||
    textColor !== initialText ||
    emailFooterText !== initialFooter ||
    tone !== initialTone;

  const sampleEmail = SAMPLE_EMAILS[tone] || SAMPLE_EMAILS.professional;

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const form = new FormData();
    form.append("logo", file);

    const res = await fetch("/api/settings/logo", { method: "POST", body: form });
    const data = await res.json();

    if (res.ok) {
      setLogoUrl(data.logo_url);
      router.refresh();
    } else {
      setError(data.error || "Upload failed");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleRemoveLogo() {
    setError(null);
    const res = await fetch("/api/settings/logo", { method: "DELETE" });
    if (res.ok) {
      setLogoUrl(null);
      router.refresh();
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const results = await Promise.all([
      fetch("/api/settings/branding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name: companyName, primary_color: primaryColor, accent_color: accentColor, text_color: textColor, email_footer_text: emailFooterText }),
      }),
      tone !== initialTone
        ? fetch("/api/settings/tone", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tone }),
          })
        : Promise.resolve({ ok: true } as Response),
    ]);

    if (results.every((r) => r.ok)) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    } else {
      const failedRes = results.find((r) => !r.ok);
      if (failedRes && "json" in failedRes) {
        const data = await failedRes.json();
        setError(data.error || "Failed to save");
      } else {
        setError("Failed to save");
      }
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      {/* Logo */}
      <div>
        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-200 mb-2">
          Logo
        </label>
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
              <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
            </div>
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-600">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-400">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {uploading ? "Uploading…" : logoUrl ? "Change logo" : "Upload logo"}
            </button>
            {logoUrl && (
              <button
                onClick={handleRemoveLogo}
                className="text-left text-xs text-red-600 hover:text-red-500 dark:text-red-400"
              >
                Remove logo
              </button>
            )}
            <p className="text-xs text-zinc-400">PNG, JPEG, WebP, or SVG. Max 2MB.</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={handleLogoUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Company name */}
      <div>
        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-200 mb-1">
          Company name
        </label>
        <input
          type="text"
          value={companyName}
          onChange={(e) => { setCompanyName(e.target.value); setSaved(false); }}
          maxLength={100}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          placeholder="Your Company"
        />
      </div>

      {/* Colors */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-200 mb-1">
            Primary color
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => { setPrimaryColor(e.target.value); setSaved(false); }}
              className="h-9 w-9 cursor-pointer rounded border border-zinc-300 p-0.5 dark:border-zinc-600"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => { setPrimaryColor(e.target.value); setSaved(false); }}
              maxLength={7}
              className="w-24 rounded-md border border-zinc-300 px-2 py-1.5 text-sm font-mono dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <p className="mt-1 text-xs text-zinc-400">Header background</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-200 mb-1">
            Accent color
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={accentColor}
              onChange={(e) => { setAccentColor(e.target.value); setSaved(false); }}
              className="h-9 w-9 cursor-pointer rounded border border-zinc-300 p-0.5 dark:border-zinc-600"
            />
            <input
              type="text"
              value={accentColor}
              onChange={(e) => { setAccentColor(e.target.value); setSaved(false); }}
              maxLength={7}
              className="w-24 rounded-md border border-zinc-300 px-2 py-1.5 text-sm font-mono dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <p className="mt-1 text-xs text-zinc-400">Buttons & links</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-200 mb-1">
            Text color
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={textColor}
              onChange={(e) => { setTextColor(e.target.value); setSaved(false); }}
              className="h-9 w-9 cursor-pointer rounded border border-zinc-300 p-0.5 dark:border-zinc-600"
            />
            <input
              type="text"
              value={textColor}
              onChange={(e) => { setTextColor(e.target.value); setSaved(false); }}
              maxLength={7}
              className="w-24 rounded-md border border-zinc-300 px-2 py-1.5 text-sm font-mono dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <p className="mt-1 text-xs text-zinc-400">Headings & body</p>
        </div>
      </div>

      {/* Tone selector */}
      <div>
        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-200 mb-2">
          Email tone
        </label>
        <div className="grid grid-cols-2 gap-2">
          {TONES.map((t) => (
            <button
              key={t.value}
              onClick={() => { setTone(t.value); setSaved(false); }}
              className={`rounded-lg border p-3 text-left transition-colors ${
                tone === t.value
                  ? "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950"
                  : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
              }`}
            >
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t.label}</p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{t.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Full email preview */}
      <div>
        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-200 mb-2">
          Email Preview
        </label>
        <div className="rounded-lg border border-zinc-200 bg-zinc-100 p-4 sm:p-6 dark:border-zinc-700 dark:bg-zinc-800">
          <div className="mx-auto max-w-[560px] overflow-hidden rounded-xl bg-white shadow-md">
            {/* Email header */}
            <div style={{ background: primaryColor }} className="px-8 py-6">
              <div className="flex items-center gap-3">
                {logoUrl && (
                  <img src={logoUrl} alt="" className="h-8 w-auto rounded object-contain" />
                )}
                <span style={{ color: accentColor }} className="text-xl font-bold">
                  {companyName || "Your Company"}
                </span>
              </div>
            </div>

            {/* Email body */}
            <div className="px-8 py-8">
              <p style={{ color: textColor }} className="mb-3 text-base leading-relaxed">
                {sampleEmail.greeting}
              </p>
              <p style={{ color: textColor }} className="mb-3 text-base leading-relaxed">
                {sampleEmail.body}
              </p>
              <p style={{ color: textColor }} className="mb-3 text-base leading-relaxed">
                {sampleEmail.closing}
              </p>

              {/* CTA button */}
              <div className="my-7">
                <span
                  style={{ background: accentColor }}
                  className="inline-block cursor-pointer rounded-lg px-7 py-3.5 text-base font-bold text-white"
                >
                  Update payment method
                </span>
              </div>

              <p className="text-sm text-gray-400">
                If you&apos;ve already updated your payment method, please disregard this email.
              </p>

              {/* Footer */}
              {emailFooterText && (
                <div className="mt-4 border-t border-gray-100 pt-3">
                  <p className="text-xs leading-relaxed text-gray-400">
                    {emailFooterText}
                  </p>
                </div>
              )}
            </div>
          </div>

          <p className="mt-3 text-center text-xs text-zinc-400 dark:text-zinc-500">
            This is how your recovery emails will look to customers
          </p>
        </div>
      </div>

      {/* Footer text */}
      <div>
        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-200 mb-1">
          Email footer text
        </label>
        <textarea
          rows={2}
          value={emailFooterText}
          onChange={(e) => { setEmailFooterText(e.target.value); setSaved(false); }}
          maxLength={500}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          placeholder="123 Main St, City, State 12345 • support@company.com"
        />
        <p className="mt-1 text-xs text-zinc-400">Shown at the bottom of every email</p>
      </div>

      {/* Save button */}
      {hasChanges && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saved && <span className="text-sm text-green-600 dark:text-green-400">Saved!</span>}
        </div>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
