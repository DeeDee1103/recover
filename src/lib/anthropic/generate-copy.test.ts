import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateReminderCopy } from "./generate-copy";

const mockCreate = vi.fn();

vi.mock("./client", () => ({
  getAnthropic: () => ({
    messages: { create: mockCreate },
  }),
}));

const baseCopyContext = {
  customerName: "Alice",
  amount: "$49.99",
  currency: "USD",
  companyName: "Acme Inc",
  tone: "professional",
  stepNumber: 1,
  totalSteps: 3,
  updateUrl: "https://example.com/pay",
};

describe("generateReminderCopy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed subject and body from AI response", async () => {
    mockCreate.mockResolvedValue({
      content: [
        { type: "text", text: JSON.stringify({ subject: "Payment reminder", body: "Please pay" }) },
      ],
    });

    const result = await generateReminderCopy(baseCopyContext);
    expect(result.subject).toBe("Payment reminder");
    expect(result.body).toBe("Please pay");
  });

  it("throws on empty AI response", async () => {
    mockCreate.mockResolvedValue({ content: [] });
    await expect(generateReminderCopy(baseCopyContext)).rejects.toThrow("AI returned empty response");
  });

  it("throws on non-text content block", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "tool_use", id: "t1" }] });
    await expect(generateReminderCopy(baseCopyContext)).rejects.toThrow("AI returned empty response");
  });

  it("throws on invalid JSON from AI", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "This is not JSON at all" }],
    });
    await expect(generateReminderCopy(baseCopyContext)).rejects.toThrow("AI returned invalid JSON");
  });

  it("throws when subject is missing", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ body: "text only" }) }],
    });
    await expect(generateReminderCopy(baseCopyContext)).rejects.toThrow("AI response missing subject or body");
  });

  it("throws when body is missing", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ subject: "subj only" }) }],
    });
    await expect(generateReminderCopy(baseCopyContext)).rejects.toThrow("AI response missing subject or body");
  });

  it("includes escalation for first step", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ subject: "s", body: "b" }) }],
    });
    await generateReminderCopy({ ...baseCopyContext, stepNumber: 1, totalSteps: 3 });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("first reminder");
  });

  it("includes escalation for final step", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ subject: "s", body: "b" }) }],
    });
    await generateReminderCopy({ ...baseCopyContext, stepNumber: 3, totalSteps: 3 });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("final reminder");
  });

  it("includes moderate urgency for middle steps", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ subject: "s", body: "b" }) }],
    });
    await generateReminderCopy({ ...baseCopyContext, stepNumber: 2, totalSteps: 3 });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("reminder 2 of 3");
  });

  it("falls back to professional tone for unknown tones", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ subject: "s", body: "b" }) }],
    });
    await generateReminderCopy({ ...baseCopyContext, tone: "unknown_tone" });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("Professional and courteous");
  });
});
