"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface BrandingEditorProps {
  companyName: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  emailFooterText: string;
}

export function BrandingEditor({
  companyName: initialName,
  logoUrl: initialLogo,
  primaryColor: initialPrimary,
  accentColor: initialAccent,
  emailFooterText: initialFooter,
}: BrandingEditorProps) {
  const [companyName, setCompanyName] = useState(initialName);
  const [primaryColor, setPrimaryColor] = useState(initialPrimary);
  const [accentColor, setAccentColor] = useState(initialAccent);
  const [emailFooterText, setEmailFooterText] = useState(initialFooter);
  const [logoUrl, setLogoUrl] = useState(initialLogo);
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
    emailFooterText !== initialFooter;

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

    const res = await fetch("/api/settings/branding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_name: companyName, primary_color: primaryColor, accent_color: accentColor, email_footer_text: emailFooterText }),
    });

    if (res.ok) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to save");
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
      <div className="grid grid-cols-2 gap-4">
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
          <p className="mt-1 text-xs text-zinc-400">Email header background</p>
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
          <p className="mt-1 text-xs text-zinc-400">Buttons & brand name</p>
        </div>
      </div>

      {/* Email preview */}
      <div>
        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-200 mb-2">
          Preview
        </label>
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
          <div style={{ background: primaryColor }} className="flex items-center gap-3 px-6 py-4">
            {logoUrl && (
              <img src={logoUrl} alt="" className="h-8 w-8 rounded object-contain" />
            )}
            <span style={{ color: accentColor }} className="text-lg font-bold">
              {companyName || "Your Company"}
            </span>
          </div>
          <div className="bg-white px-6 py-4 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">Your email content appears here...</p>
            <div className="mt-3">
              <span
                style={{ background: accentColor }}
                className="inline-block rounded-lg px-5 py-2.5 text-sm font-bold text-white"
              >
                Update payment method
              </span>
            </div>
            {emailFooterText && (
              <p className="mt-4 text-xs text-zinc-400 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                {emailFooterText}
              </p>
            )}
          </div>
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
            {saving ? "Saving…" : "Save branding"}
          </button>
          {saved && <span className="text-sm text-green-600 dark:text-green-400">Saved!</span>}
        </div>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
