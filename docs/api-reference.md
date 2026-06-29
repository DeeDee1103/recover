# Recover API Reference

## Endpoint Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/webhooks/stripe` | Stripe signature | Receives Stripe webhook events for failed and recovered payments |
| POST | `/api/settings/tone` | Supabase session | Updates the merchant's email tone preference |
| POST | `/api/sequences/update` | Supabase session | Bulk-updates steps in a reminder sequence |
| GET | `/api/stripe/connect/start` | Supabase session | Initiates Stripe Connect OAuth flow |
| GET | `/api/stripe/connect/callback` | Supabase session + OAuth state | Completes Stripe Connect OAuth and stores connection |
| POST | `/api/stripe/connect/restricted-key` | Supabase session | Validates and stores a Stripe restricted API key |
| GET, POST, PUT | `/api/inngest` | Inngest SDK signing | Inngest event ingestion and function serving |

---

## POST `/api/webhooks/stripe`

Receives incoming Stripe webhook events. Handles `invoice.payment_failed` and `invoice.paid` event types.

### Authentication

Stripe webhook signature verification. The request must include a `stripe-signature` header. The signature is verified against the configured webhook secret.

### Request

**Headers**

| Header | Required | Description |
|--------|----------|-------------|
| `stripe-signature` | Yes | Stripe webhook signature for payload verification |

**Body**

Raw request body (read as text, not parsed as JSON). The body is the Stripe event payload exactly as sent by Stripe.

### Response

| Status | Body | Condition |
|--------|------|-----------|
| 200 | `{ "received": true }` | Event processed successfully |
| 200 | `{ "received": true, "duplicate": true }` | Event was already processed (idempotency check) |
| 400 | `{ "error": "Missing signature" }` | `stripe-signature` header is absent |
| 400 | `{ "error": "Invalid signature" }` | Signature verification failed |
| 500 | `{ "error": "Internal error" }` | Failed to record event in the database |

### Behavior

1. Reads the raw request body and the `stripe-signature` header.
2. Verifies the webhook signature using `Stripe.webhooks.constructEvent`.
3. Checks the `processed_stripe_events` table for a duplicate event ID (idempotency).
4. Inserts the event ID into `processed_stripe_events` before handling (at-most-once delivery).
5. Routes by event type:
   - **`invoice.payment_failed`**: Resolves the merchant from the Stripe account ID, upserts the end customer, creates a `failed_payments` record with status `"open"`, and emits a `payment/failed` Inngest event to start the reminder sequence.
   - **`invoice.paid`**: Resolves the merchant, finds a matching failed payment with status `"open"` or `"recovering"`, marks it as `"recovered"`, writes a `recoveries` record, and emits a `payment/recovered` Inngest event to cancel pending reminders.
6. Returns `200` even if handler logic throws, to prevent Stripe retries on already-recorded events.

### Error Handling

- Duplicate events are detected via a unique constraint on `event_id`. Both the query check and the `23505` (unique violation) insert error gracefully return a duplicate response.
- Handler errors are logged but do not cause a non-200 response, since the event was already marked as processed.
- Merchant resolution logs an error and silently skips if no matching merchant is found.
- For restricted-key connections without a Stripe Connect `event.account`, the endpoint resolves the merchant only if exactly one restricted-key merchant exists. Multiple matches are treated as ambiguous and skipped.

---

## POST `/api/settings/tone`

Updates the merchant's preferred email tone for AI-generated reminder copy.

### Authentication

Supabase session cookie. The user must be authenticated via Supabase Auth.

### Request

**Headers**

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | `application/json` |
| `Cookie` | Yes | Supabase auth session cookie |

**Body**

```json
{
  "tone": "professional"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tone` | string | Yes | One of: `"professional"`, `"friendly"`, `"urgent"`, `"empathetic"` |

### Response

| Status | Body | Condition |
|--------|------|-----------|
| 200 | `{ "success": true }` | Tone updated successfully |
| 400 | `{ "error": "Invalid JSON" }` | Request body is not valid JSON |
| 400 | `{ "error": "Invalid tone" }` | Tone value is not one of the allowed values |
| 401 | `{ "error": "Unauthorized" }` | No authenticated user session |
| 500 | `{ "error": "Failed to save" }` | Database update failed |

### Behavior

1. Authenticates the user via Supabase Auth.
2. Parses and validates the JSON body.
3. Validates that `tone` is one of the four allowed values.
4. Updates the `tone` column on the `merchants` row matching the authenticated user's `auth_user_id`.

---

## POST `/api/sequences/update`

Bulk-updates the steps in a reminder sequence (timing, subject, body template).

### Authentication

Supabase session cookie. The user must be authenticated via Supabase Auth.

### Request

**Headers**

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | `application/json` |
| `Cookie` | Yes | Supabase auth session cookie |

**Body**

```json
{
  "sequence_id": "uuid",
  "steps": [
    {
      "id": "step-uuid",
      "offset_hours": 24,
      "subject": "Payment reminder for {{customer_name}}",
      "body_template": "Hi {{customer_name}}, your payment of {{amount}} failed..."
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sequence_id` | string (UUID) | Yes | The sequence to update |
| `steps` | array | Yes | Array of step objects to update |
| `steps[].id` | string (UUID) | Yes | The step ID |
| `steps[].offset_hours` | number | Yes | Hours to wait before sending this step (floored to integer, minimum 0) |
| `steps[].subject` | string | Yes | Email subject template |
| `steps[].body_template` | string | Yes | Email body template (supports `{{variable}}` placeholders) |

### Response

| Status | Body | Condition |
|--------|------|-----------|
| 200 | `{ "success": true }` | All steps updated successfully |
| 400 | `{ "error": "Invalid JSON" }` | Request body is not valid JSON |
| 400 | `{ "error": "Invalid request" }` | Missing `sequence_id` or `steps` is not an array |
| 400 | `{ "success": false, "errors": ["..."] }` | One or more steps failed validation |
| 401 | `{ "error": "Unauthorized" }` | No authenticated user session |
| 404 | `{ "error": "Merchant not found" }` | No merchant record for the authenticated user |
| 404 | `{ "error": "Sequence not found" }` | Sequence does not exist or does not belong to this merchant |
| 500 | `{ "error": "Failed to update steps" }` | Database RPC call failed |

### Behavior

1. Authenticates the user via Supabase Auth.
2. Resolves the merchant from `auth_user_id`.
3. Verifies the sequence belongs to the merchant.
4. Validates all steps in the `steps` array:
   - Each step must have `id`, `offset_hours` (number), `subject` (string), and `body_template` (string).
   - `offset_hours` is clamped to a non-negative integer (`Math.max(0, Math.floor(...))`).
   - If any step fails validation, returns all errors in a 400 response.
5. Sends all validated steps to the `batch_update_sequence_steps` Postgres RPC function, which updates them atomically in a single transaction. If any step ID does not belong to the sequence, the entire batch rolls back.

### Error Handling

- Validation failures are accumulated per-step (by array index) and returned together in a 400 response before any database write.
- The database update is atomic: all steps succeed or all roll back via the PL/pgSQL RPC function.
- Database errors return a generic "Failed to update steps" message (500). Details are logged server-side only.

---

## GET `/api/stripe/connect/start`

Initiates the Stripe Connect OAuth authorization flow by redirecting the user to Stripe.

### Authentication

Supabase session cookie. The user must be authenticated via Supabase Auth.

### Request

No request body. This is a GET request triggered by navigating to the endpoint.

### Response

| Status | Body | Condition |
|--------|------|-----------|
| 302 | Redirect to `https://connect.stripe.com/oauth/authorize` | OAuth flow initiated |
| 400 | `{ "error": "Stripe Connect is not configured..." }` | `STRIPE_CONNECT_CLIENT_ID` env var is not set |
| 401 | `{ "error": "Unauthorized" }` | No authenticated user session |

### Behavior

1. Authenticates the user via Supabase Auth.
2. Checks that the `STRIPE_CONNECT_CLIENT_ID` environment variable is set.
3. Generates a random nonce (UUID).
4. Encodes a `state` parameter as base64url JSON containing the user ID and nonce.
5. Sets a `stripe_oauth_nonce` cookie (httpOnly, secure, sameSite=lax, 10-minute TTL, scoped to the callback path).
6. Redirects to Stripe Connect OAuth with `response_type=code`, `scope=read_write`, and the callback redirect URI.

---

## GET `/api/stripe/connect/callback`

Handles the OAuth callback from Stripe Connect. Exchanges the authorization code for an access token and stores the connection.

### Authentication

Supabase session cookie. Additionally validates the OAuth `state` parameter and the `stripe_oauth_nonce` cookie.

### Request

**Query Parameters**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `code` | Yes | Authorization code from Stripe |
| `state` | Yes | Base64url-encoded JSON with `user_id` and `nonce` |
| `error` | No | Error code if the user denied access |

### Response

All responses are 302 redirects to the dashboard settings page.

| Redirect Query Param | Condition |
|----------------------|-----------|
| `?success=connected` | Connection stored successfully |
| `?error=connect_denied` | User denied the Stripe Connect authorization |
| `?error=missing_params` | Missing `code` or `state` parameter |
| `?error=invalid_state` | State parameter could not be decoded, or nonce mismatch |
| `?error=state_mismatch` | `user_id` in state does not match the authenticated user |
| `?error=no_merchant` | No merchant record found for the authenticated user |
| `?error=connect_failed` | Token exchange or database write failed |
| Redirect to `/login` | No authenticated user session |

### Behavior

1. Checks for an `error` query parameter (user denied access).
2. Validates the presence of `code` and `state`.
3. Authenticates the user via Supabase Auth.
4. Decodes the `state` from base64url JSON and verifies `user_id` matches.
5. Validates the `stripe_oauth_nonce` cookie matches the nonce in the state.
6. Exchanges the authorization code for a Stripe access token via `stripe.oauth.token`.
7. Looks up the merchant record for the authenticated user.
8. Upserts a `stripe_connections` row with `connection_method: "connect"` and `status: "active"`.
9. Redirects to the settings page with a success query parameter.

### Error Handling

- Every error case redirects back to the settings page with a descriptive error query parameter rather than returning a JSON error.
- The nonce cookie and state parameter provide CSRF protection for the OAuth flow.

---

## POST `/api/stripe/connect/restricted-key`

Validates a Stripe restricted API key and stores it as an alternative to Stripe Connect OAuth.

### Authentication

Supabase session cookie. The user must be authenticated via Supabase Auth.

### Request

**Headers**

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | `application/json` |
| `Cookie` | Yes | Supabase auth session cookie |

**Body**

```json
{
  "api_key": "rk_live_..."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `api_key` | string | Yes | A Stripe restricted API key |

### Response

| Status | Body | Condition |
|--------|------|-----------|
| 200 | `{ "success": true, "account_id": "acct_..." }` | Key validated and stored |
| 400 | `{ "error": "Invalid JSON" }` | Request body is not valid JSON |
| 400 | `{ "error": "API key is required" }` | Missing or non-string `api_key` |
| 400 | `{ "error": "Invalid API key - could not reach Stripe" }` | Key failed validation against the Stripe API |
| 401 | `{ "error": "Unauthorized" }` | No authenticated user session |
| 404 | `{ "error": "Merchant not found" }` | No merchant record for the authenticated user |

### Behavior

1. Authenticates the user via Supabase Auth.
2. Validates the `api_key` field is present and is a string.
3. Creates a temporary Stripe client with the provided key and calls `balance.retrieve()` to verify the key is valid.
4. Attempts to retrieve the Stripe account ID via `accounts.retrieve("me")`. If the key lacks account-read permission, falls back to a deterministic ID derived from the user ID and key suffix.
5. Looks up the merchant record for the authenticated user.
6. Encrypts the API key using the application's encryption utility.
7. Upserts a `stripe_connections` row with `connection_method: "restricted_key"`, the encrypted key, and `status: "active"`.
8. Returns the resolved Stripe account ID.

### Error Handling

- If the Stripe balance check fails, the key is considered invalid and a 400 is returned.
- The key is encrypted before storage and is never returned in any API response.

---

## GET, POST, PUT `/api/inngest`

Serves the Inngest framework endpoint. This is not a user-facing API; it is called by the Inngest platform to discover registered functions, receive events, and execute function steps.

### Authentication

Handled by the Inngest SDK's built-in signing key verification.

### Request

Managed entirely by the Inngest SDK. The endpoint accepts:

- **GET**: Returns function metadata for Inngest's introspection/registration.
- **POST**: Receives events and executes function steps.
- **PUT**: Used by Inngest for function registration sync.

### Registered Functions

| Function ID | Trigger Event | Cancel Event | Description |
|-------------|---------------|--------------|-------------|
| `reminder-sequence` | `payment/failed` | `payment/recovered` (matched on `data.failed_payment_id`) | Executes the multi-step email reminder sequence for a failed payment |

### Reminder Sequence Behavior

When a `payment/failed` event is received:

1. Loads the merchant's active sequence and its steps (ordered by `step_order`).
2. Loads the failed payment details, end customer info, merchant name, tone preference, and Stripe connection.
3. Marks the failed payment status as `"recovering"`.
4. For each sequence step:
   - Sleeps for the configured `offset_hours` delay.
   - Checks that the payment status is still `"open"` or `"recovering"` (exits early if recovered).
   - Generates email copy using AI (Claude via the Anthropic SDK), falling back to the template with `{{variable}}` interpolation if AI generation fails.
   - Sends the email via Resend.
   - Records a `reminders` row with send status and provider message ID.
5. If a `payment/recovered` event arrives with the same `failed_payment_id`, the entire sequence is cancelled automatically via Inngest's `cancelOn`.

### Response

Managed by the Inngest SDK. Returns appropriate responses for the Inngest platform's protocol.
