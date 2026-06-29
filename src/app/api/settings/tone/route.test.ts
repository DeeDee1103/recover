import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      update: (data: any) => {
        mockUpdate(data);
        return { eq: (col: string, val: string) => { mockEq(col, val); return { error: null }; } };
      },
    }),
  })),
}));

function makeRequest(body: any): Request {
  return new Request("http://localhost/api/settings/tone", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/settings/tone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeRequest({ tone: "professional" }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 for invalid JSON", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const req = new Request("http://localhost/api/settings/tone", {
      method: "POST",
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid JSON");
  });

  it("returns 400 for invalid tone value", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const res = await POST(makeRequest({ tone: "angry" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid tone");
  });

  it("accepts valid tone values", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });

    for (const tone of ["professional", "friendly", "urgent", "empathetic"]) {
      const res = await POST(makeRequest({ tone }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    }
  });

  it("updates with correct user ID filter", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    await POST(makeRequest({ tone: "friendly" }));
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ tone: "friendly" })
    );
    expect(mockEq).toHaveBeenCalledWith("auth_user_id", "user-123");
  });
});
