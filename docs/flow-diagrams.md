# Recover -- Flow Diagrams

This document describes the core flows of the Recover dunning/failed-payment recovery platform using Mermaid diagrams. Each section covers a distinct subsystem.

---

## 1. User Authentication Flow

A new merchant signs up with email, password, and optional company name. Supabase sends a confirmation email. When the user clicks the confirmation link, the auth callback provisions a merchant record, a default recovery sequence (4 steps), and redirects to the dashboard.

Returning users sign in with email/password and are routed directly to the dashboard.

```mermaid
sequenceDiagram
    actor User
    participant Signup as /signup
    participant Supabase as Supabase Auth
    participant Email as Email Inbox
    participant Callback as /auth/callback
    participant DB as Supabase DB
    participant Dashboard as /dashboard

    User->>Signup: Submit email, password, company name
    Signup->>Supabase: auth.signUp(email, password, metadata)
    Supabase-->>Signup: Success
    Signup-->>User: "Check your email" confirmation screen
    Supabase->>Email: Send confirmation link (redirect to /auth/callback)

    User->>Email: Click confirmation link
    Email->>Callback: GET /auth/callback?code=...
    Callback->>Supabase: exchangeCodeForSession(code)
    Supabase-->>Callback: Session + user data

    Callback->>DB: Check if merchant exists for auth_user_id
    alt Merchant does not exist
        Callback->>DB: INSERT merchant (auth_user_id, company_name)
        Callback->>DB: INSERT default sequence (4 steps)
    end
    Callback-->>User: Redirect to /dashboard
```

### Middleware Route Protection

The Next.js middleware checks every request for authentication status and enforces route access rules.

```mermaid
flowchart TD
    A[Incoming Request] --> B{Is /auth/callback or /api/* ?}
    B -- Yes --> C[Pass through unchanged]
    B -- No --> D{User authenticated?}
    D -- No --> E{Is public page? <br/> /, /login, /signup}
    E -- Yes --> C
    E -- No --> F[Redirect to /login]
    D -- Yes --> G{Is /login or /signup?}
    G -- Yes --> H[Redirect to /dashboard]
    G -- No --> C
```

---

## 2. Stripe Connect OAuth Flow

Merchants connect their Stripe account via OAuth. The flow uses a nonce stored in a secure cookie to prevent CSRF. On success, a `stripe_connections` record is upserted with `connection_method: "connect"`.

```mermaid
sequenceDiagram
    actor Merchant
    participant Settings as /dashboard/settings
    participant Start as /api/stripe/connect/start
    participant StripeOAuth as connect.stripe.com
    participant Callback as /api/stripe/connect/callback
    participant StripeAPI as Stripe API
    participant DB as Supabase DB

    Merchant->>Settings: Click "Connect Stripe"
    Settings->>Start: GET /api/stripe/connect/start

    Start->>Start: Verify user is authenticated
    Start->>Start: Generate nonce (UUID)
    Start->>Start: Encode state = base64url({user_id, nonce})
    Start-->>Merchant: Set stripe_oauth_nonce cookie (httpOnly, secure, 10 min TTL)
    Start-->>Merchant: Redirect to Stripe OAuth authorize URL

    Merchant->>StripeOAuth: Authorize Recover app
    StripeOAuth-->>Callback: Redirect with ?code=...&state=...

    Callback->>Callback: Verify user is authenticated
    Callback->>Callback: Decode state, check user_id matches session
    Callback->>Callback: Compare nonce from cookie vs. nonce in state
    alt Nonce mismatch or missing
        Callback-->>Merchant: Redirect to settings?error=invalid_state
    end

    Callback->>StripeAPI: oauth.token({ grant_type: authorization_code, code })
    StripeAPI-->>Callback: { stripe_user_id }

    Callback->>DB: Look up merchant by auth_user_id
    Callback->>DB: UPSERT stripe_connections (merchant_id, stripe_account_id, method=connect, status=active)
    Callback-->>Merchant: Redirect to settings?success=connected
```

---

## 3. Restricted Key Setup Flow

As an alternative to OAuth, merchants can paste a Stripe restricted API key. The key is validated by calling the Stripe Balance API, then AES-encrypted before storage.

```mermaid
sequenceDiagram
    actor Merchant
    participant Settings as /dashboard/settings
    participant API as /api/stripe/connect/restricted-key
    participant StripeAPI as Stripe API
    participant Crypto as encrypt()
    participant DB as Supabase DB

    Merchant->>Settings: Paste restricted API key
    Settings->>API: POST { api_key }

    API->>API: Verify user is authenticated
    API->>API: Validate api_key is a non-empty string

    API->>StripeAPI: balance.retrieve() using submitted key
    alt Key is invalid
        API-->>Merchant: 400 "Invalid API key"
    end

    API->>StripeAPI: accounts.retrieve("me") to get account ID
    alt Account read not permitted
        API->>API: Derive deterministic ID from user_id + key suffix
    end

    API->>DB: Look up merchant by auth_user_id
    API->>Crypto: encrypt(api_key) with AES
    API->>DB: UPSERT stripe_connections (merchant_id, stripe_account_id, method=restricted_key, restricted_key_encrypted, status=active)
    API-->>Merchant: 200 { success: true, account_id }
```

---

## 4. Webhook Processing Flow

Stripe sends webhook events to `/api/webhooks/stripe`. The handler verifies the signature, deduplicates via the `processed_stripe_events` table, resolves the merchant, and routes to type-specific handlers. Failed payments trigger Inngest recovery sequences; successful payments mark prior failures as recovered.

```mermaid
flowchart TD
    A[Stripe sends POST /api/webhooks/stripe] --> B{stripe-signature header present?}
    B -- No --> B1[400 Missing signature]
    B -- Yes --> C{constructEvent signature valid?}
    C -- No --> C1[400 Invalid signature]
    C -- Yes --> D{Event ID in processed_stripe_events?}
    D -- Yes --> D1[200 duplicate: true]
    D -- No --> E[INSERT event into processed_stripe_events]
    E --> F{Insert succeeded?}
    F -- No, code 23505 --> D1
    F -- No, other --> F1[500 Internal error]
    F -- Yes --> G{event.type?}

    G -- invoice.payment_failed --> H[handlePaymentFailed]
    G -- invoice.paid --> I[handlePaymentSucceeded]
    G -- other --> J[200 received: true]

    H --> J
    I --> J
```

### handlePaymentFailed Detail

```mermaid
sequenceDiagram
    participant Handler as handlePaymentFailed
    participant DB as Supabase DB
    participant Inngest as Inngest

    Handler->>DB: resolveMerchant(event.account)
    Note over Handler,DB: OAuth: lookup by stripe_account_id<br/>Restricted key: single active restricted-key merchant<br/>Ambiguous: skip event

    alt No merchant found
        Handler-->>Handler: Log error, return
    end

    Handler->>DB: UPSERT end_customer (merchant_id, stripe_customer_id, email, name)
    Handler->>DB: Check for existing failed_payment with same invoice ID
    alt Already exists
        Handler-->>Handler: Return (deduplicate)
    end

    Handler->>DB: INSERT failed_payment (status=open, amount, currency, failure_reason)
    Handler->>Inngest: Send "payment/failed" event (failed_payment_id, merchant_id, stripe_invoice_id)
```

### handlePaymentSucceeded Detail

```mermaid
sequenceDiagram
    participant Handler as handlePaymentSucceeded
    participant DB as Supabase DB
    participant Inngest as Inngest

    Handler->>DB: resolveMerchant(event.account)
    alt No merchant found
        Handler-->>Handler: Return
    end

    Handler->>DB: Find open/recovering failed_payment by invoice ID
    alt No matching failed payment
        Handler-->>Handler: Return (not a recovery)
    end

    Handler->>DB: UPDATE failed_payment status = "recovered"
    Handler->>DB: INSERT recovery record (amount_recovered)
    Handler->>Inngest: Send "payment/recovered" event (cancels pending sequence)
```

---

## 5. Recovery Sequence Flow

When a `payment/failed` Inngest event fires, the `reminder-sequence` function executes the merchant's active recovery sequence step by step. Each step waits its configured delay, checks if the payment is still outstanding, generates email copy (AI with template fallback), and sends via Resend.

The entire function is cancelled automatically if a `payment/recovered` event arrives with a matching `failed_payment_id`.

```mermaid
sequenceDiagram
    participant Inngest as Inngest Runtime
    participant Fn as reminder-sequence
    participant DB as Supabase DB
    participant AI as Anthropic API
    participant Resend as Resend Email

    Note over Inngest,Fn: Trigger: "payment/failed"<br/>Cancel: "payment/recovered" matching failed_payment_id

    Inngest->>Fn: Execute with { failed_payment_id, merchant_id }

    Fn->>DB: Load active sequence + steps for merchant
    alt No active sequence
        Fn-->>Inngest: { status: "no_sequence" }
    end

    Fn->>DB: Load failed_payment + end_customer + merchant info + stripe_connection
    Fn->>DB: UPDATE failed_payment status = "recovering"

    loop For each sequence step (ordered by step_order)
        alt offset_hours > 0
            Fn->>Fn: sleep(offset_hours)
        end

        Fn->>DB: Check failed_payment status
        alt Status is NOT open/recovering
            Fn-->>Inngest: { status: "recovered_during_sequence" }
        end

        alt Customer has no email
            Fn->>DB: INSERT reminder (status=cancelled)
        else Customer has email
            Fn->>AI: generateReminderCopy(customerName, amount, tone, step#, ...)
            alt AI succeeds
                Note over Fn: Use AI-generated subject + body
            else AI fails
                Note over Fn: Fall back to template with {{variable}} replacement
            end

            Fn->>Resend: Send email (from merchant, to customer)
            alt Send succeeds
                Fn->>DB: INSERT reminder (status=sent, provider_message_id)
            else Send fails
                Fn->>DB: INSERT reminder (status=cancelled)
            end
        end
    end

    Fn-->>Inngest: { status: "sequence_complete" }
```

### Default Sequence Steps (provisioned at signup)

```mermaid
flowchart LR
    S1["Step 1<br/>Immediately<br/>'Action required'"] --> S2["Step 2<br/>+72 hours<br/>'Friendly reminder'"]
    S2 --> S3["Step 3<br/>+120 hours<br/>'Subscription at risk'"]
    S3 --> S4["Step 4<br/>+168 hours<br/>'Final notice'"]

    style S1 fill:#e8f5e9,stroke:#2e7d32
    style S2 fill:#fff3e0,stroke:#ef6c00
    style S3 fill:#fff3e0,stroke:#ef6c00
    style S4 fill:#ffebee,stroke:#c62828
```

---

## 6. Dashboard Data Flow

All dashboard pages follow the same pattern: the middleware ensures the user is authenticated, then server components load the merchant record scoped to the authenticated user and query data scoped to that merchant.

```mermaid
flowchart TD
    A[Browser requests /dashboard/*] --> B[Next.js Middleware]
    B --> C{User authenticated?}
    C -- No --> D[Redirect to /login]
    C -- Yes --> E[Server Component renders]

    E --> F[supabase.auth.getUser]
    F --> G[Query merchants WHERE auth_user_id = user.id]
    G --> H{Merchant exists?}
    H -- No --> I[Show onboarding / error]
    H -- Yes --> J[merchant_id established]

    J --> K[Query scoped data]
    K --> K1[failed_payments WHERE merchant_id]
    K --> K2[recoveries WHERE merchant_id via join]
    K --> K3[reminders WHERE merchant_id via join]
    K --> K4[stripe_connections WHERE merchant_id]
    K --> K5[sequences + sequence_steps WHERE merchant_id]

    K1 --> L[Render Dashboard UI]
    K2 --> L
    K3 --> L
    K4 --> L
    K5 --> L
```

### Data Scoping Model

Every query is scoped by `merchant_id`, which is derived from the authenticated user's `auth_user_id`. This ensures strict tenant isolation -- a merchant can only see their own failed payments, recoveries, and configuration.

```mermaid
erDiagram
    AUTH_USER ||--|| MERCHANT : "1:1 via auth_user_id"
    MERCHANT ||--o{ STRIPE_CONNECTION : "has"
    MERCHANT ||--o{ SEQUENCE : "has"
    MERCHANT ||--o{ FAILED_PAYMENT : "has"
    MERCHANT ||--o{ END_CUSTOMER : "has"
    SEQUENCE ||--o{ SEQUENCE_STEP : "has"
    FAILED_PAYMENT ||--o{ REMINDER : "has"
    FAILED_PAYMENT ||--o| RECOVERY : "may have"
    END_CUSTOMER ||--o{ FAILED_PAYMENT : "has"
```

---

## End-to-End: Payment Failure to Recovery

This diagram shows the complete lifecycle from a payment failing in Stripe to a successful recovery.

```mermaid
sequenceDiagram
    participant Stripe
    participant Webhook as /api/webhooks/stripe
    participant DB as Supabase DB
    participant Inngest
    participant AI as Anthropic
    participant Resend
    participant Customer as End Customer

    Stripe->>Webhook: invoice.payment_failed
    Webhook->>Webhook: Verify signature + deduplicate
    Webhook->>DB: Resolve merchant, upsert end_customer
    Webhook->>DB: INSERT failed_payment (status=open)
    Webhook->>Inngest: Emit "payment/failed"

    Inngest->>DB: Load sequence steps
    Inngest->>DB: Mark payment as "recovering"

    loop Recovery emails (steps 1-4)
        Inngest->>DB: Check payment still open/recovering
        Inngest->>AI: Generate personalized email copy
        AI-->>Inngest: Subject + body
        Inngest->>Resend: Send recovery email
        Resend->>Customer: Deliver email
        Inngest->>DB: Record reminder (status=sent)
        Note over Inngest: Sleep until next step
    end

    Customer->>Stripe: Updates payment method, invoice paid
    Stripe->>Webhook: invoice.paid
    Webhook->>DB: Mark failed_payment as "recovered"
    Webhook->>DB: INSERT recovery record
    Webhook->>Inngest: Emit "payment/recovered"
    Note over Inngest: Sequence cancelled via cancelOn
```
