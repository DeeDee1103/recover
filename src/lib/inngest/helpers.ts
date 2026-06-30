export { formatCents as formatAmount } from "@/lib/format";

export function buildUpdateUrl(stripeInvoiceId?: string | null): string {
  if (stripeInvoiceId) {
    return `https://invoice.stripe.com/i/${stripeInvoiceId}`;
  }
  const baseUrl = process.env.APP_URL || "https://app.recover.dev";
  return `${baseUrl}/update-payment`;
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || "");
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface BrandingOptions {
  primaryColor?: string;
  accentColor?: string;
  logoUrl?: string | null;
  footerText?: string | null;
}

export function buildEmailHtml(body: string, updateUrl: string, companyName: string, branding?: BrandingOptions): string {
  const safeCompany = escapeHtml(companyName);
  const validatedUrl = /^https?:\/\//.test(updateUrl) ? updateUrl : "";
  const safeUrl = escapeHtml(validatedUrl);
  const primary = branding?.primaryColor || "#112E2A";
  const accent = branding?.accentColor || "#C5862F";
  const logoUrl = branding?.logoUrl;
  const footerText = branding?.footerText;

  const bodyHtml = body
    .split("\n")
    .map((line) => (line.trim() === "" ? "<br/>" : `<p style="margin:0 0 12px;color:#333;font-size:16px;line-height:1.5;">${escapeHtml(line)}</p>`))
    .join("");

  const logoHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="" style="height:32px;width:auto;margin-right:12px;border-radius:4px;vertical-align:middle;" />`
    : "";

  const footerHtml = footerText
    ? `<p style="margin:16px 0 0;font-size:12px;color:#999;border-top:1px solid #eee;padding-top:12px;">${escapeHtml(footerText)}</p>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:${primary};padding:24px 32px;">
      ${logoHtml}<span style="color:${accent};font-weight:700;font-size:20px;vertical-align:middle;">${safeCompany}</span>
    </div>
    <div style="padding:32px;">
      ${bodyHtml}
      <div style="margin:28px 0;">
        <a href="${safeUrl}" style="display:inline-block;background:${accent};color:#fff;font-weight:700;font-size:16px;padding:14px 28px;border-radius:8px;text-decoration:none;">Update payment method</a>
      </div>
      <p style="margin:24px 0 0;font-size:13px;color:#888;">
        If you've already updated your payment method, please disregard this email.
      </p>
      ${footerHtml}
    </div>
  </div>
</body>
</html>`;
}
