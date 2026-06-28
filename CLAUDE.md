# CLAUDE.md — Recover (Dunning / Failed-Payment Recovery)

## What this is
A multi-tenant SaaS that recovers failed subscription payments. Merchants connect their Stripe account; when an end-customer's payment fails, we run an automated branded reminder sequence (email), nudge them to update their card via a Stripe-hosted surface, detect recovery, and report it on a dashboard.

**Goal:** $10k MRR micro-SaaS product.

## Stack
- **Framework:** Next.js 14, App Router, TypeScript, Server Actions
- **DB / Auth:** Supabase (Postgres + Auth + RLS)
- **Background jobs:** Inngest (step functions for timed reminder sequences)
- **Email:** Resend
- **Payments / integration target:** Stripe (Connect for merchants; Billing for our own subscription later)
- **AI (M5):** Anthropic Claude Sonnet for personalized reminder copy
- **Hosting:** Vercel-ready. Dev on Windows (WSL2 available).

## Architecture decisions
- **RLS everywhere:** Every tenant table has RLS policies scoped to the merchant's `auth.uid()`. Server-side webhook/Inngest code uses the Supabase service role key to bypass RLS.
- **Webhook idempotency:** `processed_stripe_events` table with `event_id` as PK. Check-then-insert before processing any webhook. This is a non-negotiable guardrail.
- **No card data:** We never store PAN/card data. Only Stripe IDs and hosted URLs. End-customers update their cards on Stripe-hosted surfaces.
- **Inngest for sequences:** Each failed payment spawns an Inngest step function that sleeps between reminder steps. The function is cancellable by a `payment.recovered` event.
- **Stripe Connect OAuth + restricted-key fallback:** OAuth is the production path. Restricted keys let us test the full loop locally without the OAuth redirect dance.

## Data model
See `supabase/migrations/00001_initial_schema.sql` for the full schema. Key tables:
- `merchants` — 1:1 with Supabase auth user
- `stripe_connections` — merchant's Stripe account link
- `end_customers` — the merchant's subscribers
- `failed_payments` — tracks each failure through open → recovering → recovered/lost
- `sequences` / `sequence_steps` — the reminder cadence template
- `reminders` — individual scheduled/sent messages
- `recoveries` — successful recovery records
- `processed_stripe_events` — webhook idempotency

## Project structure
```
recover/
├── src/
│   ├── app/                    # Next.js App Router pages + API routes
│   │   ├── api/
│   │   │   ├── webhooks/stripe/  # Stripe webhook endpoint
│   │   │   ├── stripe/connect/   # OAuth start + callback
│   │   │   └── inngest/          # Inngest serve endpoint
│   │   ├── dashboard/            # Main dashboard
│   │   ├── settings/             # Sequence editor + Stripe connection
│   │   └── auth/                 # Login/signup
│   ├── lib/
│   │   ├── supabase/             # Client + server Supabase helpers
│   │   ├── stripe/               # Stripe client + helpers
│   │   ├── inngest/              # Inngest client + functions
│   │   └── resend/               # Email sending helpers
│   └── types/                    # Shared TypeScript types
├── supabase/
│   └── migrations/               # SQL migration files
├── docs/
│   └── index.html                # Landing page (GitHub Pages)
├── build-prompt.md               # Full build spec (M0–M6)
├── .env.example
└── CLAUDE.md
```

## Build milestones
- **M0 ✅ Scaffold** — project structure, all deps, migrations, RLS, `.env.example`
- **M1 — Auth + Stripe Connect** — signup/login, Connect OAuth, restricted-key fallback
- **M2 — Webhook + detection** — webhook endpoint, signature verify, idempotency, `failed_payments` creation
- **M3 — Sequence + email + recovery** — Inngest step function, Resend emails, recovery detection + cancellation
- **M4 — Dashboard** — metrics, filterable table, sequence editor, settings
- **M5 — (Optional) AI copy** — Claude Sonnet generates reminder copy
- **M6 — (Optional) SMS + billing** — Twilio, our own Stripe subscription tiers

## Live assets
- **Landing page:** https://deedee1103.github.io/recover/
- **Supabase project:** xfryjvpfauvuattxlbkf (schema deployed)
- **Stripe:** test mode, restricted-key fallback for local dev

## Dev commands
```bash
npm run dev          # Start Next.js dev server
npx inngest-cli dev  # Start Inngest dev server (separate terminal)
stripe listen --forward-to localhost:3000/api/webhooks/stripe  # Forward Stripe webhooks
```

## Non-negotiable guardrails
1. Verify every Stripe webhook signature. Reject unsigned/invalid.
2. Never process the same `event_id` twice (idempotency).
3. Never store card/PAN data. Only Stripe IDs and hosted URLs.
4. RLS on every tenant table. Merchant A cannot read merchant B's data.
5. Secrets in env only, never committed.
