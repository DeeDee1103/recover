import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockGetUser = vi.fn();
const mockSingle = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table === "merchants") {
        return {
          select: () => ({ eq: () => ({ single: () => mockSingle() }) }),
        };
      }
      if (table === "sequences") {
        return {
          select: () => ({ eq: (_c: string, _v: string) => ({ eq: () => ({ single: () => mockSingle() }) }) }),
        };
      }
      return {};
    },
    rpc: mockRpc,
  })),
}));

function makeRequest(body: any): Request {
  return new Request("http://localhost/api/sequences/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/sequences/update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeRequest({ sequence_id: "s1", steps: [] }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const req = new Request("http://localhost", { method: "POST", body: "{{bad" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid JSON");
  });

  it("returns 400 when sequence_id missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const res = await POST(makeRequest({ steps: [] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid request");
  });

  it("returns 400 when steps is not an array", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const res = await POST(makeRequest({ sequence_id: "s1", steps: "not-array" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid request");
  });

  it("returns 404 when merchant not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockSingle.mockResolvedValueOnce({ data: null });
    const res = await POST(makeRequest({ sequence_id: "s1", steps: [] }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Merchant not found");
  });

  it("returns 400 for invalid step fields", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockSingle
      .mockResolvedValueOnce({ data: { id: "m1" } })
      .mockResolvedValueOnce({ data: { id: "s1" } });

    const res = await POST(makeRequest({
      sequence_id: "s1",
      steps: [
        { id: "step1", offset_hours: "not-a-number", subject: "Hi", body_template: "test" },
      ],
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.errors[0]).toContain("index 0");
  });

  it("clamps offset_hours before sending to RPC", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockSingle
      .mockResolvedValueOnce({ data: { id: "m1" } })
      .mockResolvedValueOnce({ data: { id: "s1" } });
    mockRpc.mockResolvedValue({ error: null });

    await POST(makeRequest({
      sequence_id: "s1",
      steps: [
        { id: "step1", offset_hours: -5.7, subject: "Hi", body_template: "test" },
      ],
    }));

    expect(mockRpc).toHaveBeenCalledWith("batch_update_sequence_steps", {
      p_sequence_id: "s1",
      p_steps: [
        { id: "step1", offset_hours: 0, subject: "Hi", body_template: "test" },
      ],
    });
  });

  it("returns success when RPC succeeds", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockSingle
      .mockResolvedValueOnce({ data: { id: "m1" } })
      .mockResolvedValueOnce({ data: { id: "s1" } });
    mockRpc.mockResolvedValue({ error: null });

    const res = await POST(makeRequest({
      sequence_id: "s1",
      steps: [
        { id: "step1", offset_hours: 24, subject: "Reminder", body_template: "Hi {{name}}" },
      ],
    }));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it("returns 500 when RPC fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockSingle
      .mockResolvedValueOnce({ data: { id: "m1" } })
      .mockResolvedValueOnce({ data: { id: "s1" } });
    mockRpc.mockResolvedValue({ error: { message: "Step not found" } });

    const res = await POST(makeRequest({
      sequence_id: "s1",
      steps: [
        { id: "step1", offset_hours: 24, subject: "Reminder", body_template: "Hi" },
      ],
    }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Failed to update steps");
  });
});
