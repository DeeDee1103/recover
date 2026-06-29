# Recover

Automated dunning and failed-payment recovery for SaaS businesses. Recover detects failed Stripe payments, sends AI-generated recovery email sequences, and tracks results in a real-time dashboard.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, TypeScript, React 19) |
| Database | Supabase (Postgres + Auth + RLS) |
| Payments | Stripe (Connect OAuth + restricted key fallback) |
| Background jobs | Inngest (durable step functions) |
| Email | Resend (branded HTML templates) |
| AI copy | Anthropic Claude Sonnet (tone-aware generation) |
| Encryption | AES-256-GCM for API keys at rest |
| Deployment | Vercel |

## Quick start

```bash
# Install dependencies
npm install

# Copy environment template and fill in your keys
cp .env.example .env.local

# Run database migrations via Supabase dashboard or CLI

# Start the dev server
npm run dev

# In separate terminals:
npx inngest-cli@latest dev      # background jobs
stripe listen --forward-to localhost:3000/api/webhooks/stripe  # webhooks
```

See [docs/setup-guide.md](docs/setup-guide.md) for the full setup walkthrough.

## How it works

1. A customer's payment fails on Stripe
2. Stripe fires an `invoice.payment_failed` webhook to Recover
3. Recover creates a `failed_payment` record and triggers an Inngest recovery sequence
4. The sequence sends a series of timed reminder emails (AI-generated or template-based)
5. When Stripe reports `invoice.paid`, Recover marks the payment as recovered and cancels remaining reminders

## Documentation

| Document | Description |
|----------|------------|
| [Architecture](docs/architecture.md) | System overview, service roles, database schema, security model, multi-tenancy |
| [Flow diagrams](docs/flow-diagrams.md) | Mermaid sequence and flow diagrams for auth, webhooks, recovery, OAuth |
| [API reference](docs/api-reference.md) | All endpoints with request/response schemas and behavior |
| [Setup guide](docs/setup-guide.md) | Local dev, Vercel deployment, environment variables, post-deploy checklist |

## Project structure

```
src/
  app/
    api/
      inngest/              # Inngest function serve endpoint
      sequences/update/     # Sequence step editor API
      settings/tone/        # Tone preference API
      stripe/connect/       # OAuth start, callback, restricted key
      webhooks/stripe/      # Stripe webhook handler
    auth/callback/          # Supabase auth callback + merchant provisioning
    dashboard/              # Dashboard pages (metrics, payments, sequences, settings)
    login/ signup/          # Auth pages
  lib/
    anthropic/              # AI copy generation
    crypto/                 # AES-256-GCM encrypt/decrypt
    inngest/                # Recovery sequence step function
    resend/                 # Email client
    stripe/                 # Stripe client
    supabase/               # Session-scoped and service-role clients
    format.ts               # Shared formatting utilities
  types/
    database.ts             # TypeScript interfaces for all 9 tables
supabase/
  migrations/               # 4 migration files (schema, constraints, indexes, RPC)
docs/                       # Technical documentation
```

## Environment variables

See [.env.example](.env.example) for all required variables. Key services:

- **Supabase** -- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Stripe** -- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_CLIENT_ID`
- **Inngest** -- `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`
- **Resend** -- `RESEND_API_KEY`
- **Encryption** -- `ENCRYPTION_KEY` (32 bytes, hex-encoded)
- **AI (optional)** -- `ANTHROPIC_API_KEY`

## License

Private -- all rights reserved.
