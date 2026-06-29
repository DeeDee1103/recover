import { describe, it, expect } from "vitest";
import { formatCents } from "./format";

describe("formatCents", () => {
  it("formats USD cents to dollars", () => {
    expect(formatCents(1999)).toBe("$19.99");
  });

  it("formats zero", () => {
    expect(formatCents(0)).toBe("$0.00");
  });

  it("formats large amounts", () => {
    expect(formatCents(100000)).toBe("$1,000.00");
  });

  it("handles single cent", () => {
    expect(formatCents(1)).toBe("$0.01");
  });

  it("uses currency parameter", () => {
    const result = formatCents(1500, "eur");
    expect(result).toContain("15.00");
  });

  it("handles uppercase currency", () => {
    const result = formatCents(1500, "GBP");
    expect(result).toContain("15.00");
  });

  it("defaults to USD", () => {
    expect(formatCents(500)).toBe("$5.00");
  });
});
