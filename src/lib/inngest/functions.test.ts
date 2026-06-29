import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

const mockSendEmail = vi.fn();
vi.mock("@/lib/resend/client", () => ({
  getResend: () => ({
    emails: { send: mockSendEmail },
  }),
}));

const mockGenerateCopy = vi.fn();
vi.mock("@/lib/anthropic/generate-copy", () => ({
  generateReminderCopy: (...args: unknown[]) => mockGenerateCopy(...args),
}));

vi.mock("./helpers", async () => {
  const actual = await vi.importActual<typeof import("./helpers")>("./helpers");
  return actual;
});

interface StepRun {
  (name: string, fn: () => Promise<unknown>): Promise<unknown>;
}

interface StepSleep {
  (id: string, duration: string): Promise<void>;
}

let capturedHandler: (ctx: { event: { data: Record<string, string> }; step: { run: StepRun; sleep: StepSleep } }) => Promise<unknown>;

vi.mock("./client", () => ({
  inngest: {
    createFunction: (_config: unknown, handler: typeof capturedHandler) => {
      capturedHandler = handler;
      return { id: "reminder-sequence" };
    },
  },
}));

beforeAll(async () => {
  await import("./functions");
});

function createMockStep() {
  const sleepCalls: Array<{ id: string; duration: string }> = [];
  return {
    run: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
    sleep: vi.fn(async (id: string, duration: string) => {
      sleepCalls.push({ id, duration });
    }),
    sleepCalls,
  };
}

function setupFromMock(table: string, response: unknown) {
  return {
    select: () => ({
      eq: (..._args: unknown[]) => {
        if (table === "sequences" || table === "merchants" || table === "stripe_connections") {
          return {
            eq: () => ({
              order: () => ({
                limit: () => ({
                  single: () => Promise.resolve(response),
                }),
              }),
              single: () => Promise.resolve(response),
            }),
            single: () => Promise.resolve(response),
          };
        }
        if (table === "failed_payments") {
          return {
            single: () => Promise.resolve(response),
          };
        }
        return { single: () => Promise.resolve(response) };
      },
    }),
    insert: vi.fn(() => Promise.resolve({ error: null })),
    update: vi.fn(() => ({
      eq: () => Promise.resolve({ error: null }),
    })),
    order: () => ({
      limit: () => ({
        single: () => Promise.resolve(response),
      }),
    }),
  };
}

const sampleSteps = [
  { id: "s1", step_order: 1, offset_hours: 0, subject: "Hi {{customer_name}}", body_template: "Pay {{amount}}", channel: "email" },
  { id: "s2", step_order: 2, offset_hours: 24, subject: "Reminder", body_template: "Please pay {{amount}}", channel: "email" },
];

const samplePayment = {
  id: "fp1",
  amount: 4999,
  currency: "usd",
  status: "open",
  end_customers: { email: "alice@example.com", name: "Alice", stripe_customer_id: "cus_123" },
};

describe("reminderSequence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_URL = "https://app.recover.dev";
  });

  it("returns no_sequence when no active sequence exists", async () => {
    const step = createMockStep();
    mockFrom.mockImplementation((table: string) => {
      if (table === "sequences") return setupFromMock(table, { data: null });
      return setupFromMock(table, { data: null });
    });

    const result = await capturedHandler({
      event: { data: { failed_payment_id: "fp1", merchant_id: "m1" } },
      step,
    });

    expect(result).toEqual({ status: "no_sequence" });
  });

  it("returns payment_not_found when payment does not exist", async () => {
    const step = createMockStep();
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "sequences") {
        return setupFromMock(table, { data: { id: "seq1" } });
      }
      if (table === "sequence_steps") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: sampleSteps }),
            }),
          }),
        };
      }
      if (table === "failed_payments") {
        return setupFromMock(table, { data: null });
      }
      if (table === "merchants") {
        return setupFromMock(table, { data: null });
      }
      return setupFromMock(table, { data: null });
    });

    const result = await capturedHandler({
      event: { data: { failed_payment_id: "fp1", merchant_id: "m1" } },
      step,
    });

    expect(result).toEqual({ status: "payment_not_found" });
  });

  it("marks payment as recovering after loading context", async () => {
    const step = createMockStep();
    const mockUpdate = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));
    const insertMock = vi.fn(() => Promise.resolve({ error: null }));

    mockFrom.mockImplementation((table: string) => {
      if (table === "sequences") {
        return setupFromMock(table, { data: { id: "seq1" } });
      }
      if (table === "sequence_steps") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [sampleSteps[0]] }),
            }),
          }),
        };
      }
      if (table === "failed_payments") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: samplePayment }),
            }),
          }),
          update: mockUpdate,
        };
      }
      if (table === "merchants") {
        return setupFromMock(table, { data: { company_name: "Acme", tone: "professional" } });
      }
      if (table === "stripe_connections") {
        return setupFromMock(table, { data: { stripe_account_id: "acct_123" } });
      }
      if (table === "reminders") {
        return { insert: insertMock };
      }
      return setupFromMock(table, { data: null });
    });

    mockGenerateCopy.mockRejectedValue(new Error("AI unavailable"));
    mockSendEmail.mockResolvedValue({ data: { id: "msg_123" } });

    await capturedHandler({
      event: { data: { failed_payment_id: "fp1", merchant_id: "m1" } },
      step,
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      status: "recovering",
      updated_at: expect.any(String),
    });
  });

  it("sleeps for the configured offset_hours between steps", async () => {
    const step = createMockStep();
    const insertMock = vi.fn(() => Promise.resolve({ error: null }));

    mockFrom.mockImplementation((table: string) => {
      if (table === "sequences") {
        return setupFromMock(table, { data: { id: "seq1" } });
      }
      if (table === "sequence_steps") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: sampleSteps }),
            }),
          }),
        };
      }
      if (table === "failed_payments") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { ...samplePayment, status: "recovering" } }),
            }),
          }),
          update: vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) })),
        };
      }
      if (table === "merchants") {
        return setupFromMock(table, { data: { company_name: "Acme", tone: "professional" } });
      }
      if (table === "stripe_connections") {
        return setupFromMock(table, { data: { stripe_account_id: "acct_123" } });
      }
      if (table === "reminders") {
        return { insert: insertMock };
      }
      return setupFromMock(table, { data: null });
    });

    mockGenerateCopy.mockRejectedValue(new Error("skip AI"));
    mockSendEmail.mockResolvedValue({ data: { id: "msg_1" } });

    await capturedHandler({
      event: { data: { failed_payment_id: "fp1", merchant_id: "m1" } },
      step,
    });

    expect(step.sleep).toHaveBeenCalledWith("wait-step-2", "24h");
    expect(step.sleep).not.toHaveBeenCalledWith("wait-step-1", expect.any(String));
  });

  it("stops early when payment is recovered mid-sequence", async () => {
    const step = createMockStep();

    mockFrom.mockImplementation((table: string) => {
      if (table === "sequences") {
        return setupFromMock(table, { data: { id: "seq1" } });
      }
      if (table === "sequence_steps") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: sampleSteps }),
            }),
          }),
        };
      }
      if (table === "failed_payments") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { ...samplePayment, status: "recovered" } }),
            }),
          }),
          update: vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) })),
        };
      }
      if (table === "merchants") {
        return setupFromMock(table, { data: { company_name: "Acme", tone: "professional" } });
      }
      if (table === "stripe_connections") {
        return setupFromMock(table, { data: { stripe_account_id: "acct_123" } });
      }
      return setupFromMock(table, { data: null });
    });

    const result = await capturedHandler({
      event: { data: { failed_payment_id: "fp1", merchant_id: "m1" } },
      step,
    });

    expect(result).toEqual({ status: "recovered_during_sequence" });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("skips sending and records cancelled reminder when customer has no email", async () => {
    const step = createMockStep();
    const insertMock = vi.fn(() => Promise.resolve({ error: null }));
    const paymentNoEmail = {
      ...samplePayment,
      end_customers: { email: null, name: "Alice", stripe_customer_id: "cus_123" },
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === "sequences") {
        return setupFromMock(table, { data: { id: "seq1" } });
      }
      if (table === "sequence_steps") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [sampleSteps[0]] }),
            }),
          }),
        };
      }
      if (table === "failed_payments") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: paymentNoEmail }),
            }),
          }),
          update: vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) })),
        };
      }
      if (table === "merchants") {
        return setupFromMock(table, { data: { company_name: "Acme", tone: "professional" } });
      }
      if (table === "stripe_connections") {
        return setupFromMock(table, { data: { stripe_account_id: "acct_123" } });
      }
      if (table === "reminders") {
        return { insert: insertMock };
      }
      return setupFromMock(table, { data: null });
    });

    await capturedHandler({
      event: { data: { failed_payment_id: "fp1", merchant_id: "m1" } },
      step,
    });

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled" })
    );
  });

  it("uses AI-generated copy when available", async () => {
    const step = createMockStep();
    const insertMock = vi.fn(() => Promise.resolve({ error: null }));

    mockFrom.mockImplementation((table: string) => {
      if (table === "sequences") {
        return setupFromMock(table, { data: { id: "seq1" } });
      }
      if (table === "sequence_steps") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [sampleSteps[0]] }),
            }),
          }),
        };
      }
      if (table === "failed_payments") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: samplePayment }),
            }),
          }),
          update: vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) })),
        };
      }
      if (table === "merchants") {
        return setupFromMock(table, { data: { company_name: "Acme", tone: "friendly" } });
      }
      if (table === "stripe_connections") {
        return setupFromMock(table, { data: { stripe_account_id: "acct_123" } });
      }
      if (table === "reminders") {
        return { insert: insertMock };
      }
      return setupFromMock(table, { data: null });
    });

    mockGenerateCopy.mockResolvedValue({
      subject: "AI Subject",
      body: "AI Body content",
    });
    mockSendEmail.mockResolvedValue({ data: { id: "msg_ai" } });

    await capturedHandler({
      event: { data: { failed_payment_id: "fp1", merchant_id: "m1" } },
      step,
    });

    expect(mockGenerateCopy).toHaveBeenCalledWith(
      expect.objectContaining({
        customerName: "Alice",
        tone: "friendly",
        stepNumber: 1,
        totalSteps: 1,
      })
    );
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "AI Subject",
        to: ["alice@example.com"],
      })
    );
  });

  it("falls back to template when AI fails", async () => {
    const step = createMockStep();
    const insertMock = vi.fn(() => Promise.resolve({ error: null }));

    mockFrom.mockImplementation((table: string) => {
      if (table === "sequences") {
        return setupFromMock(table, { data: { id: "seq1" } });
      }
      if (table === "sequence_steps") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [sampleSteps[0]] }),
            }),
          }),
        };
      }
      if (table === "failed_payments") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: samplePayment }),
            }),
          }),
          update: vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) })),
        };
      }
      if (table === "merchants") {
        return setupFromMock(table, { data: { company_name: "Acme", tone: "professional" } });
      }
      if (table === "stripe_connections") {
        return setupFromMock(table, { data: { stripe_account_id: "acct_123" } });
      }
      if (table === "reminders") {
        return { insert: insertMock };
      }
      return setupFromMock(table, { data: null });
    });

    mockGenerateCopy.mockRejectedValue(new Error("AI down"));
    mockSendEmail.mockResolvedValue({ data: { id: "msg_tmpl" } });

    await capturedHandler({
      event: { data: { failed_payment_id: "fp1", merchant_id: "m1" } },
      step,
    });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Hi Alice",
        to: ["alice@example.com"],
      })
    );
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "sent",
        provider_message_id: "msg_tmpl",
      })
    );
  });

  it("records cancelled reminder when email send fails", async () => {
    const step = createMockStep();
    const insertMock = vi.fn(() => Promise.resolve({ error: null }));

    mockFrom.mockImplementation((table: string) => {
      if (table === "sequences") {
        return setupFromMock(table, { data: { id: "seq1" } });
      }
      if (table === "sequence_steps") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [sampleSteps[0]] }),
            }),
          }),
        };
      }
      if (table === "failed_payments") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: samplePayment }),
            }),
          }),
          update: vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) })),
        };
      }
      if (table === "merchants") {
        return setupFromMock(table, { data: { company_name: "Acme", tone: "professional" } });
      }
      if (table === "stripe_connections") {
        return setupFromMock(table, { data: { stripe_account_id: "acct_123" } });
      }
      if (table === "reminders") {
        return { insert: insertMock };
      }
      return setupFromMock(table, { data: null });
    });

    mockGenerateCopy.mockRejectedValue(new Error("AI off"));
    mockSendEmail.mockRejectedValue(new Error("Resend error"));

    await capturedHandler({
      event: { data: { failed_payment_id: "fp1", merchant_id: "m1" } },
      step,
    });

    const cancelledCall = insertMock.mock.calls.find(
      (call: unknown[]) => (call[0] as Record<string, unknown>).status === "cancelled"
    );
    expect(cancelledCall).toBeTruthy();
  });

  it("returns sequence_complete after all steps finish", async () => {
    const step = createMockStep();
    const insertMock = vi.fn(() => Promise.resolve({ error: null }));

    mockFrom.mockImplementation((table: string) => {
      if (table === "sequences") {
        return setupFromMock(table, { data: { id: "seq1" } });
      }
      if (table === "sequence_steps") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [sampleSteps[0]] }),
            }),
          }),
        };
      }
      if (table === "failed_payments") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: samplePayment }),
            }),
          }),
          update: vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) })),
        };
      }
      if (table === "merchants") {
        return setupFromMock(table, { data: { company_name: "Acme", tone: "professional" } });
      }
      if (table === "stripe_connections") {
        return setupFromMock(table, { data: { stripe_account_id: "acct_123" } });
      }
      if (table === "reminders") {
        return { insert: insertMock };
      }
      return setupFromMock(table, { data: null });
    });

    mockGenerateCopy.mockRejectedValue(new Error("skip"));
    mockSendEmail.mockResolvedValue({ data: { id: "msg_1" } });

    const result = await capturedHandler({
      event: { data: { failed_payment_id: "fp1", merchant_id: "m1" } },
      step,
    });

    expect(result).toEqual({ status: "sequence_complete" });
  });

  it("defaults merchantName to 'Our Team' when company_name is null", async () => {
    const step = createMockStep();
    const insertMock = vi.fn(() => Promise.resolve({ error: null }));

    mockFrom.mockImplementation((table: string) => {
      if (table === "sequences") {
        return setupFromMock(table, { data: { id: "seq1" } });
      }
      if (table === "sequence_steps") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [sampleSteps[0]] }),
            }),
          }),
        };
      }
      if (table === "failed_payments") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: samplePayment }),
            }),
          }),
          update: vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) })),
        };
      }
      if (table === "merchants") {
        return setupFromMock(table, { data: { company_name: null, tone: "professional" } });
      }
      if (table === "stripe_connections") {
        return setupFromMock(table, { data: { stripe_account_id: "acct_123" } });
      }
      if (table === "reminders") {
        return { insert: insertMock };
      }
      return setupFromMock(table, { data: null });
    });

    mockGenerateCopy.mockRejectedValue(new Error("skip"));
    mockSendEmail.mockResolvedValue({ data: { id: "msg_1" } });

    await capturedHandler({
      event: { data: { failed_payment_id: "fp1", merchant_id: "m1" } },
      step,
    });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Our Team <recover@updates.recover-app.com>",
      })
    );
  });
});
