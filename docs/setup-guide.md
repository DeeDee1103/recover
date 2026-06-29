# Recover -- Setup & Deployment Guide

Recover is a dunning/failed-payment recovery platform for SaaS businesses. It monitors Stripe payment failures via webhooks, runs automated email reminder sequences through Inngest, and lets merchants track recovery metrics on a dashboard.

**Stack:** Next.js 16 / React 19, Supabase (Postgres + Auth), Stripe Connect, Inngest, Resend, Tailwind CSS 4.

---

## 1. Prerequisites

| Requirement | Minimum version | Notes |
|---|---|---|
| Node.js | 20.x+ | Required by Next.js 16 |
| npm | 10.x+ | Ships with Node 20 |
| Git | 2.x | For cloning and version control |

### Accounts you will need

| Service | Purpose | Free tier available? |
|---|---|---|
| [Supabase](https://supabase.com) | Postgres database, auth, RLS | Yes |
| [Stripe](https://stripe.com) | Payment processing, Connect platform, webhooks | Yes (test mode) |
| [Inngest](https://inngest.com) | Background job orchestration for reminder sequences | Yes |
| [Resend](https://resend.com) | Transactional email delivery | Yes (100 emails/day) |
| [Anthropic](https://console.anthropic.com) | AI-generated email copy (optional, M5 feature) | Paid only |
| [Vercel](https://vercel.com) | Hosting and deployment (optional for local dev) | Yes |

---

## 2. Local Development Setup

### 2.1 Clone and install

```bash
git clone <your-repo-url> recover
cd recover
npm install
```

### 2.2 Create a Supabase project

1. Go to [app.supabase.com](https://app.supabase.com) and create a new project.
2. From **Project Settings > API**, copy:
   - **Project URL** (e.g. `https://abcdefghij.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)
   - **service_role key** (starts with `eyJ...`) -- keep this secret; it bypasses RLS.

### 2.3 Set up Stripe in test mode

1. Create or log into your [Stripe Dashboard](https://dashboard.stripe.com).
2. Toggle to **Test mode** (top-right).
3. From **Developers > API keys**, copy the **Secret key** (`sk_test_...`).

**Stripe Connect (platform app):**

4. Go to **Settings > Connect > Platform settings**.
5. Create a Connect application (Standard or Express type).
6. Copy the **Client ID** (`ca_...`).
7. Add `http://localhost:3000/api/stripe/connect/callback` as an allowed redirect URI.

**Stripe CLI (webhook forwarding):**

8. Install the [Stripe CLI](https://docs.stripe.com/stripe-cli) and log in:
   ```bash
   stripe login
   ```
9. Forward webhooks to your local server:
   ```bash
   stripe listen --forward-to http://localhost:3000/api/webhooks/stripe
   ```
10. The CLI prints a webhook signing secret (`whsec_...`). Copy it for your `.env.local`.

### 2.4 Configure Inngest dev server

1. Install the Inngest CLI:
   ```bash
   npm install -g inngest-cli
   ```
2. Start the dev server:
   ```bash
   npx inngest-cli@latest dev
   ```
3. The dev server runs at `http://localhost:8288` by default.
4. From your [Inngest dashboard](https://app.inngest.com), copy:
   - **Event Key**
   - **Signing Key**

For local development, the Inngest dev server auto-discovers functions served at `http://localhost:3000/api/inngest`.

### 2.5 Set up Resend

1. Sign up at [resend.com](https://resend.com).
2. Go to **API Keys** and create a new key. Copy it (`re_...`).
3. Under **Domains**, add and verify your sending domain (DNS records required). For local testing you can use the built-in `onboarding@resend.dev` sender.

### 2.6 Get an Anthropic API key (optional)

This is only needed for the M5 AI-generated email copy feature.

1. Go to [console.anthropic.com](https://console.anthropic.com).
2. Create an API key (`sk-ant-...`).

### 2.7 Generate an encryption key

Recover encrypts Stripe tokens at rest. Generate a 256-bit hex key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the 64-character hex string.

### 2.8 Create .env.local

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local` with the credentials gathered above. See [Section 6](#6-environment-variables-reference) for a full reference.

---

## 3. Database Setup

### 3.1 Run migrations

Recover includes four migration files in `supabase/migrations/`. Apply them in order using the Supabase SQL Editor or the CLI.

**Option A -- Supabase Dashboard:**

1. Go to your project's **SQL Editor** in the Supabase dashboard.
2. Paste and run each file in order:
   - `00001_initial_schema.sql` -- Creates all core tables (merchants, stripe_connections, end_customers, failed_payments, sequences, sequence_steps, reminders, recoveries, processed_stripe_events) with RLS policies.
   - `00002_add_unique_constraints.sql` -- Adds unique constraints for end_customer and stripe_connection upserts.
   - `00003_add_tone_indexes_constraints.sql` -- Adds the `tone` column to merchants, uniqueness constraints for failed_payments and reminders, and performance indexes.
   - `00004_add_batch_update_steps_rpc.sql` -- Creates the `batch_update_sequence_steps` RPC function for atomic sequence step updates.

**Option B -- Supabase CLI (if using local dev):**

```bash
supabase db push
```

### 3.2 Verify RLS policies

After running migrations, confirm Row Level Security is active:

1. In the Supabase dashboard, go to **Database > Tables**.
2. Check that every table (except `processed_stripe_events`) shows the RLS shield icon as enabled.
3. The `processed_stripe_events` table intentionally has no RLS -- it is only accessed server-side using the service role key.

**Tables with RLS enabled:**
- `merchants` -- filtered by `auth_user_id = auth.uid()`
- `stripe_connections` -- filtered by merchant ownership
- `end_customers` -- filtered by merchant ownership
- `failed_payments` -- filtered by merchant ownership
- `sequences` -- filtered by merchant ownership
- `sequence_steps` -- filtered via sequence -> merchant chain
- `reminders` -- filtered via failed_payment -> merchant chain
- `recoveries` -- filtered via failed_payment -> merchant chain

---

## 4. Running Locally

You need three processes running simultaneously.

### 4.1 Start the Next.js dev server

```bash
npm run dev
```

The app is available at [http://localhost:3000](http://localhost:3000).

### 4.2 Start the Inngest dev server

In a separate terminal:

```bash
npx inngest-cli@latest dev
```

The Inngest dashboard is available at [http://localhost:8288](http://localhost:8288). It auto-discovers the functions served at `/api/inngest`.

### 4.3 Start Stripe CLI for webhook forwarding

In a third terminal:

```bash
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe
```

This forwards `invoice.payment_failed` and `invoice.paid` events to your local webhook handler.

**To trigger a test payment failure:**

```bash
stripe trigger invoice.payment_failed
```

### Route overview

| Route | Purpose |
|---|---|
| `/api/webhooks/stripe` | Receives Stripe webhook events (payment_failed, invoice.paid) |
| `/api/inngest` | Inngest function serving endpoint (GET/POST/PUT) |
| `/api/stripe/connect/start` | Initiates Stripe Connect OAuth flow |
| `/api/stripe/connect/callback` | Handles Stripe Connect OAuth callback |
| `/api/stripe/connect/restricted-key` | Alternative: restricted API key connection |
| `/api/settings/tone` | Update merchant email tone preference |
| `/api/sequences/update` | Update reminder sequence configuration |

---

## 5. Vercel Deployment

### 5.1 Connect your repository

1. Go to [vercel.com/new](https://vercel.com/new).
2. Import your GitHub repository.
3. Vercel auto-detects the Next.js framework. Accept the defaults.

### 5.2 Set environment variables

In your Vercel project, go to **Settings > Environment Variables** and add every variable from `.env.example`. See the [reference table](#6-environment-variables-reference) below.

Important differences from local:

| Variable | Production value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your hosted Supabase project URL (not localhost) |
| `STRIPE_SECRET_KEY` | Use a live-mode key (`sk_live_...`) for production |
| `STRIPE_WEBHOOK_SECRET` | A new signing secret from your production webhook endpoint |
| `APP_URL` | Your Vercel deployment URL (e.g. `https://recover.vercel.app`) |

### 5.3 Configure webhook URLs

**Stripe:**

1. In the Stripe Dashboard, go to **Developers > Webhooks**.
2. Click **Add endpoint**.
3. Set the URL to `https://your-domain.vercel.app/api/webhooks/stripe`.
4. Select events to listen to:
   - `invoice.payment_failed`
   - `invoice.paid`
5. If using Stripe Connect, check **Listen to events on Connected accounts**.
6. Copy the new **Signing secret** and update `STRIPE_WEBHOOK_SECRET` in Vercel.

**Inngest:**

1. In the [Inngest dashboard](https://app.inngest.com), go to your app settings.
2. Set the app URL to `https://your-domain.vercel.app/api/inngest`.
3. Inngest will sync automatically and discover the `reminderSequence` function.

**Stripe Connect redirect URI:**

1. In Stripe **Settings > Connect > Platform settings**, add your production callback:
   `https://your-domain.vercel.app/api/stripe/connect/callback`

### 5.4 Verify security headers

Recover configures the following security headers in `next.config.ts`. After deploying, verify them with a tool like [securityheaders.com](https://securityheaders.com):

| Header | Value |
|---|---|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |

---

## 6. Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL. Use `http://localhost:54321` for local Supabase, or your hosted project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key. Safe to expose client-side; RLS policies enforce access control. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key. Server-side only. Bypasses RLS -- used by webhook handlers and Inngest functions. Never expose to the client. |
| `STRIPE_SECRET_KEY` | Yes | Stripe API secret key. Use `sk_test_...` for development, `sk_live_...` for production. |
| `STRIPE_CONNECT_CLIENT_ID` | Yes | Stripe Connect platform application client ID (`ca_...`). Required for OAuth-based merchant onboarding. |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret (`whsec_...`). Used to verify webhook event signatures. Different for local (Stripe CLI) vs. production. |
| `RESEND_API_KEY` | Yes | Resend API key (`re_...`). Used to send dunning reminder emails. |
| `INNGEST_EVENT_KEY` | Yes | Inngest event key for sending events from your app. |
| `INNGEST_SIGNING_KEY` | Yes | Inngest signing key for verifying requests from the Inngest platform. |
| `ANTHROPIC_API_KEY` | No | Anthropic API key (`sk-ant-...`). Only needed for AI-powered email copy generation (M5 feature). |
| `ENCRYPTION_KEY` | Yes | 64-character hex string (256-bit key) for encrypting Stripe tokens and restricted keys at rest. Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `APP_URL` | Yes | Base URL of the application. `http://localhost:3000` for local development; your production domain for deployment. Used for generating links in emails and Stripe redirects. |

---

## 7. Post-Deployment Checklist

After deploying to production, verify each integration end-to-end.

### Stripe webhook registration

- [ ] Webhook endpoint is registered at `https://your-domain/api/webhooks/stripe`
- [ ] Events `invoice.payment_failed` and `invoice.paid` are selected
- [ ] "Listen to events on Connected accounts" is enabled (if using Stripe Connect)
- [ ] The signing secret in `STRIPE_WEBHOOK_SECRET` matches the one shown in the Stripe dashboard
- [ ] Send a test webhook from Stripe Dashboard > Webhooks > "Send test webhook" and confirm a 200 response

### Inngest app connection

- [ ] Inngest has synced with `https://your-domain/api/inngest`
- [ ] The `reminderSequence` function appears in the Inngest dashboard under your app
- [ ] `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` are set correctly in Vercel

### Resend domain verification

- [ ] Your sending domain is verified in the Resend dashboard (green checkmark)
- [ ] DNS records (DKIM, SPF, DMARC) are correctly configured
- [ ] Send a test email from the Resend dashboard to confirm deliverability

### Test a payment failure (end-to-end)

1. **Connect a test Stripe account** -- use the Stripe Connect flow or add a restricted key through the dashboard.
2. **Trigger a payment failure** -- In Stripe test mode, create a subscription for a customer using the test card `4000000000000341` (always declines). Alternatively, use the Stripe CLI:
   ```bash
   stripe trigger invoice.payment_failed
   ```
3. **Verify the webhook is received** -- Check the Stripe Dashboard webhook logs for a successful delivery (HTTP 200).
4. **Confirm the failed payment appears** -- Log into the Recover dashboard and check the Payments page.
5. **Verify the reminder sequence started** -- Check the Inngest dashboard for a `payment/failed` event and an active `reminderSequence` run.
6. **Confirm email delivery** -- After the first step's `offset_hours` elapses (or use the Inngest dashboard to manually trigger the step), verify the reminder email is delivered via Resend.
7. **Test recovery** -- Pay the invoice in Stripe test mode. Confirm the `invoice.paid` webhook marks the payment as "recovered" and cancels pending reminders.
