# Claude Code Build Prompt — "Recover" (Dunning / Failed-Payment Recovery SaaS)

> Paste this whole file into Claude Code as your initial spec. Build **incrementally, one milestone at a time** — after each milestone, run it, verify the acceptance checks, then move on. Do **not** scaffold all milestones at once.

---

## 1. What we're building

A multi-tenant SaaS that recovers failed subscription payments for membership and SaaS businesses. A customer ("merchant") connects their Stripe account; when one of their end-customers' payments fails, we automatically run a branded, multi-touch reminder sequence (email now, SMS later), nudge the customer to update their card, detect when the payment is recovered, and report recovered revenue on a dashboard.

The product's entire value is: **reliable failed-payment detection → a smart reminder sequence → accurate recovery attribution → a clean dashboard.** Keep that loop tight. Do not build a full billing platform — Stripe owns card data and retries; we orchestrate the human-facing recovery layer on top.

## 2. Tech stack (do not substitute without asking)

- **Framework:** Next.js 14 (App Router, TypeScript, Server Actions where sensible)
- **DB / Auth:** Supabase (Postgres + Auth + Row-Level Security)
- **Background jobs / scheduling:** Inngest (step functions for the timed reminder sequence)
- **Email:** Resend
- **Payments / integration target + our own billing:** Stripe (Connect for merchants; Billing for our subscription)
- **AI (optional, Milestone 5):** Anthropic Claude Sonnet (`claude-sonnet-4-6`) for personalized reminder copy
- **Hosting:** Vercel-ready. Dev on Windows; assume WSL2 is available.

## 3. MVP scope

**In scope (build this):**
- Merchant signup/login (Supabase Auth)
- Connect a merchant's Stripe account (Connect OAuth; restricted-key fallback for local dev)
- Ingest Stripe webhook events from connected accounts, with signature verification + idempotency
- Create a "failed payment" record on `invoice.payment_failed`
- Run a configurable reminder sequence via Inngest (default: day 0, 3, 5, 7)
- Send branded emails via Resend with an "update payment method" CTA (Stripe hosted invoice / customer portal link)
- Detect recovery (`invoice.payment_succeeded` / `charge.succeeded`) and cancel any pending reminders
- Dashboard: recovered $ and count, recovery rate, list of open/recovering/recovered/lost items
- Sequence editor (cadence + template per step) and settings

**Explicitly OUT of scope for MVP (do not build yet):**
- SMS (Milestone 6), our own paid billing tiers (Milestone 6), multi-user teams/roles, in-app card collection (always send customers to Stripe-hosted surfaces — we never touch card data), analytics beyond the core metrics.

## 4. Data model (Supabase / Postgres, all tenant-scoped with RLS)

- `merchants` — maps 1:1 to a Supabase auth user (the paying customer)
- `stripe_connections` — `merchant_id`, `stripe_account_id`, connection method (`connect` | `restricted_key`), token reference, `status`
- `end_customers` — `merchant_id`, `stripe_customer_id`, `email`, `name`
- `failed_payments` — `merchant_id`, `stripe_invoice_id`, `stripe_charge_id`, `end_customer_id`, `amount`, `currency`, `failure_reason`, `failed_at`, `status` (`open` | `recovering` | `recovered` | `lost`)
- `sequences` — `merchant_id`, name, active flag (one default seeded per merchant)
- `sequence_steps` — `sequence_id`, `step_order`, `offset_hours`, `subject`, `body_template`, `channel` (`email` now)
- `reminders` — `failed_payment_id`, `step_order`, `channel`, `scheduled_at`, `sent_at`, `status`, `provider_message_id`
- `recoveries` — `failed_payment_id`, `recovered_at`, `amount_recovered`
- `processed_stripe_events` — `event_id` (PK, for idempotency), `type`, `processed_at`

Enforce **RLS** so a merchant can only ever read/write their own rows. Server-side webhook/Inngest code uses the service role.

## 5. Core flows

1. **Connect Stripe:** `/api/stripe/connect/start` → Stripe OAuth → `/api/stripe/connect/callback` stores the connection. (Fallback: a settings form that accepts a restricted API key for local/dev so the loop is testable immediately.)
2. **Webhook ingestion:** `POST /api/webhooks/stripe` receives connected-account events. Verify the signature with the Connect webhook secret, dedupe against `processed_stripe_events`, then emit an Inngest event. Return 200 fast.
3. **On payment failed (Inngest `payment.failed`):** upsert `end_customer` + `failed_payments` (status `open`), then start the sequence step function.
4. **Reminder sequence (Inngest step fn):** for each `sequence_step`, `step.sleep` to its offset, re-check the payment is still unrecovered, then send via Resend and log a `reminders` row. Make the whole run **cancellable** by a `payment.recovered` event for that invoice.
5. **On recovery (Inngest `payment.recovered`):** mark `failed_payments.status = recovered`, write a `recoveries` row, cancel pending reminders.
6. **Dashboard:** server components querying aggregates (recovered $/count, recovery rate = recovered ÷ total failed in range) + a table with filters.

## 6. Non-negotiable guardrails

- **Verify every Stripe webhook signature.** Reject unsigned/invalid.
- **Idempotency:** never process the same `event_id` twice.
- **Never store card/PAN data.** Only Stripe IDs and hosted URLs.
- **RLS on every tenant table.** Test that merchant A cannot read merchant B's rows.
- **Secrets in env only**, never committed. Provide `.env.example`.
- Use **Stripe test mode** + the **Stripe CLI** for local webhook forwarding.

## 7. Build milestones (ship + verify each before continuing)

- **M0 — Scaffold:** Next.js 14 + TS + Supabase client, Inngest, Resend, Stripe SDKs wired. Create `CLAUDE.md` capturing architecture + decisions. Add migrations for all tables + RLS. Add `.env.example`. *Acceptance:* app boots, migrations apply, RLS policies exist.
- **M1 — Auth + Stripe connect:** Supabase Auth; Connect OAuth start/callback; restricted-key fallback in settings. *Acceptance:* a merchant can sign up and connect a (test) Stripe account; connection persists.
- **M2 — Webhook + detection:** `/api/webhooks/stripe` with signature verify + idempotency; creates `failed_payments`. *Acceptance:* `stripe trigger invoice.payment_failed` creates exactly one record; re-delivering the same event creates none.
- **M3 — Sequence + email + recovery:** Inngest sequence with Resend sends and "update card" CTA; recovery cancels pending reminders. *Acceptance:* a triggered failure schedules step 1; simulating `invoice.payment_succeeded` flips status to `recovered` and cancels remaining sends.
- **M4 — Dashboard:** metrics + filterable table + sequence editor + settings. *Acceptance:* recovered totals and recovery rate render correctly against seeded data.
- **M5 — (Optional) AI copy:** Claude Sonnet generates per-customer reminder copy from a tone setting; falls back to templates on error.
- **M6 — (Optional) SMS + our billing:** Twilio channel; our own Stripe subscription with 3 tiers gating volume.

## 8. Env vars (put in `.env.example`)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_CONNECT_CLIENT_ID`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `ANTHROPIC_API_KEY`, `APP_URL`

## 9. How I want you (Claude Code) to work

- Confirm your plan for the current milestone in one short paragraph before writing code, then build it.
- Keep strictly to MVP scope; if you're tempted to add something outside §3, ask first.
- Write minimal but real tests for the two riskiest things: **webhook idempotency** and **recovery attribution/cancellation**.
- After each milestone, give me the exact Stripe CLI / manual steps to verify it.
- Maintain `CLAUDE.md` as you make decisions so future sessions have context.
- Ask before any destructive action (dropping tables, deleting data, rewriting migrations).
- Default to TypeScript, server components, and the simplest thing that satisfies the acceptance check.

**Start with M0.** Confirm the plan, scaffold the repo, write `CLAUDE.md` and the schema + RLS migrations, and give me the verification steps.
