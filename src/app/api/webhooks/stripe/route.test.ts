import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockFrom = vi.fn();

vi.mock("@/lib/stripe/client", () => {
  const constructEvent = vi.fn();
  return {
    Stripe: {
      webhooks: { constructEvent },
    },
    __constructEvent: constructEvent,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({ from: mockFrom }),
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: vi.fn() },
}));

async function getConstructEvent() {
  const mod = await import("@/lib/stripe/client") as any;
  return mod.__constructEvent;
}

function makeRequest(body: string, sig?: string): Request {
  const headers: Record<string, string> = {};
  if (sig) headers["stripe-signature"] = sig;
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body,
    headers,
  });
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when signature header is missing", async () => {
    const res = await POST(makeRequest("body"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Missing signature");
  });

  it("returns 400 when signature verification fails", async () => {
    const constructEvent = await getConstructEvent();
    constructEvent.mockImplementation(() => {
      throw new Error("Bad sig");
    });

    const res = await POST(makeRequest("body", "sig_test"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid signature");
  });

  it("returns duplicate:true for already-processed events", async () => {
    const constructEvent = await getConstructEvent();
    constructEvent.mockReturnValue({
      id: "evt_1",
      type: "invoice.payment_failed",
      data: { object: {} },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "processed_stripe_events") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { event_id: "evt_1" } }),
            }),
          }),
        };
      }
      return {};
    });

    const res = await POST(makeRequest("body", "sig_test"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.duplicate).toBe(true);
  });

  it("returns 200 for unhandled event types", async () => {
    const constructEvent = await getConstructEvent();
    constructEvent.mockReturnValue({
      id: "evt_2",
      type: "customer.created",
      data: { object: {} },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "processed_stripe_events") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null }),
            }),
          }),
          insert: () => Promise.resolve({ error: null }),
        };
      }
      return {};
    });

    const res = await POST(makeRequest("body", "sig_test"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
  });

  it("handles concurrent duplicate via unique constraint (23505)", async () => {
    const constructEvent = await getConstructEvent();
    constructEvent.mockReturnValue({
      id: "evt_3",
      type: "invoice.payment_failed",
      data: { object: {} },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "processed_stripe_events") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null }),
            }),
          }),
          insert: () => Promise.resolve({ error: { code: "23505" } }),
        };
      }
      return {};
    });

    const res = await POST(makeRequest("body", "sig_test"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.duplicate).toBe(true);
  });

  it("returns 500 for non-duplicate insert errors", async () => {
    const constructEvent = await getConstructEvent();
    constructEvent.mockReturnValue({
      id: "evt_4",
      type: "invoice.payment_failed",
      data: { object: {} },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "processed_stripe_events") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null }),
            }),
          }),
          insert: () => Promise.resolve({ error: { code: "42000", message: "DB error" } }),
        };
      }
      return {};
    });

    const res = await POST(makeRequest("body", "sig_test"));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Internal error");
  });
});
