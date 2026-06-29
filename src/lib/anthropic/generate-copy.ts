import { getAnthropic } from "./client";

interface CopyContext {
  customerName: string;
  amount: string;
  currency: string;
  companyName: string;
  tone: string;
  stepNumber: number;
  totalSteps: number;
  updateUrl: string;
}

interface GeneratedCopy {
  subject: string;
  body: string;
}

export async function generateReminderCopy(ctx: CopyContext): Promise<GeneratedCopy> {
  const anthropic = getAnthropic();

  const toneDescriptions: Record<string, string> = {
    professional: "Professional and courteous. Business-appropriate language, respectful but clear about the urgency.",
    friendly: "Warm and friendly. Conversational tone, empathetic, like a helpful friend reminding them.",
    urgent: "Direct and urgent. Clear that action is needed soon, without being aggressive or threatening.",
    empathetic: "Empathetic and understanding. Acknowledge that payment issues happen, offer support.",
  };

  const toneGuide = toneDescriptions[ctx.tone] || toneDescriptions.professional;

  const escalation = ctx.stepNumber === 1
    ? "This is the first reminder — be gentle."
    : ctx.stepNumber === ctx.totalSteps
    ? "This is the final reminder — convey that this is the last notice before access may be affected."
    : `This is reminder ${ctx.stepNumber} of ${ctx.totalSteps} — moderate urgency.`;

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `Generate an email subject line and body for a failed payment reminder.

Context:
- Customer name: ${ctx.customerName}
- Amount due: ${ctx.amount} ${ctx.currency}
- Company: ${ctx.companyName}
- ${escalation}

Tone: ${toneGuide}

Rules:
- Subject: under 60 characters, no emojis
- Body: 2-4 short paragraphs, plain text (no HTML)
- Include a call to action to update their payment method
- Do NOT include any URLs — the system adds the button automatically
- Do NOT use placeholder brackets like [Company] — use the actual values provided
- Be concise

Respond in exactly this JSON format:
{"subject": "...", "body": "..."}`,
      },
    ],
  });

  const textBlock = msg.content?.[0];
  const text = textBlock && textBlock.type === "text" ? textBlock.text : "";

  if (!text) {
    throw new Error("AI returned empty response");
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`AI returned invalid JSON: ${text.slice(0, 100)}`);
  }

  if (!parsed.subject || !parsed.body) {
    throw new Error("AI response missing subject or body");
  }

  return { subject: parsed.subject, body: parsed.body };
}
