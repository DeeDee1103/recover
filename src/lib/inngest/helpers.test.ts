import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  formatAmount,
  buildUpdateUrl,
  renderTemplate,
  escapeHtml,
  buildEmailHtml,
} from "./helpers";

describe("formatAmount", () => {
  it("formats cents to currency string", () => {
    expect(formatAmount(4999, "usd")).toBe("$49.99");
  });

  it("handles zero", () => {
    expect(formatAmount(0, "usd")).toBe("$0.00");
  });

  it("handles large amounts", () => {
    expect(formatAmount(1000000, "usd")).toBe("$10,000.00");
  });
});

describe("buildUpdateUrl", () => {
  const originalEnv = process.env.APP_URL;

  beforeEach(() => {
    process.env.APP_URL = "https://test.recover.dev";
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.APP_URL = originalEnv;
    } else {
      delete process.env.APP_URL;
    }
  });

  it("returns Stripe hosted invoice URL when stripeInvoiceId provided", () => {
    const url = buildUpdateUrl("in_1234abc");
    expect(url).toBe("https://invoice.stripe.com/i/in_1234abc");
  });

  it("returns fallback update-payment page when no invoiceId", () => {
    const url = buildUpdateUrl();
    expect(url).toBe("https://test.recover.dev/update-payment");
  });

  it("returns fallback for undefined", () => {
    const url = buildUpdateUrl(undefined);
    expect(url).toBe("https://test.recover.dev/update-payment");
  });

  it("returns fallback for null", () => {
    const url = buildUpdateUrl(null);
    expect(url).toBe("https://test.recover.dev/update-payment");
  });

  it("uses fallback URL when APP_URL not set", () => {
    delete process.env.APP_URL;
    const url = buildUpdateUrl();
    expect(url).toContain("https://app.recover.dev");
  });
});

describe("renderTemplate", () => {
  it("replaces template variables", () => {
    const result = renderTemplate("Hello {{name}}, you owe {{amount}}", {
      name: "Alice",
      amount: "$50",
    });
    expect(result).toBe("Hello Alice, you owe $50");
  });

  it("replaces missing vars with empty string", () => {
    const result = renderTemplate("Hello {{name}}", {});
    expect(result).toBe("Hello ");
  });

  it("handles no variables", () => {
    const result = renderTemplate("No vars here", { name: "test" });
    expect(result).toBe("No vars here");
  });

  it("handles multiple occurrences of same var", () => {
    const result = renderTemplate("{{x}} and {{x}}", { x: "hi" });
    expect(result).toBe("hi and hi");
  });
});

describe("escapeHtml", () => {
  it("escapes ampersands", () => {
    expect(escapeHtml("A & B")).toBe("A &amp; B");
  });

  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;"
    );
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('He said "hello"')).toBe("He said &quot;hello&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's a test")).toBe("it&#39;s a test");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("leaves safe strings unchanged", () => {
    expect(escapeHtml("Hello World")).toBe("Hello World");
  });

  it("escapes multiple special chars together", () => {
    expect(escapeHtml('<div class="x">&')).toBe(
      "&lt;div class=&quot;x&quot;&gt;&amp;"
    );
  });
});

describe("buildEmailHtml", () => {
  it("produces valid HTML with escaped company name", () => {
    const html = buildEmailHtml("Test body", "https://example.com", "Acme & Co");
    expect(html).toContain("Acme &amp; Co");
    expect(html).toContain("https://example.com");
    expect(html).toContain("Test body");
  });

  it("escapes HTML in body lines", () => {
    const html = buildEmailHtml("<script>alert(1)</script>", "#", "Test");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("converts newlines to paragraphs", () => {
    const html = buildEmailHtml("Line 1\nLine 2", "#", "Test");
    expect(html).toContain("<p");
    expect(html).toContain("Line 1");
    expect(html).toContain("Line 2");
  });

  it("converts blank lines to br tags", () => {
    const html = buildEmailHtml("Line 1\n\nLine 2", "#", "Test");
    expect(html).toContain("<br/>");
  });

  it("includes the update payment button", () => {
    const html = buildEmailHtml("body", "https://pay.me", "Co");
    expect(html).toContain('href="https://pay.me"');
    expect(html).toContain("Update payment method");
  });
});
