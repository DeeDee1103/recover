-- M5 tone column (already applied manually to prod, idempotent via IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'merchants' AND column_name = 'tone'
  ) THEN
    ALTER TABLE merchants ADD COLUMN tone text NOT NULL DEFAULT 'professional';
  END IF;
END $$;

-- Prevent duplicate failed_payment rows for the same invoice per merchant
ALTER TABLE failed_payments
  ADD CONSTRAINT failed_payments_merchant_invoice_unique
  UNIQUE (merchant_id, stripe_invoice_id);

-- Prevent duplicate reminder rows for the same step of a payment
ALTER TABLE reminders
  ADD CONSTRAINT reminders_payment_step_unique
  UNIQUE (failed_payment_id, step_order);

-- Index for webhook merchant lookup by Stripe account ID
CREATE INDEX IF NOT EXISTS idx_stripe_connections_account_id
  ON stripe_connections (stripe_account_id);

-- Index for dashboard/payments queries filtering by merchant + status
CREATE INDEX IF NOT EXISTS idx_failed_payments_merchant_status
  ON failed_payments (merchant_id, status);

-- Index for webhook duplicate-invoice check
CREATE INDEX IF NOT EXISTS idx_failed_payments_merchant_invoice
  ON failed_payments (merchant_id, stripe_invoice_id);

-- Index for reminder lookups by failed payment
CREATE INDEX IF NOT EXISTS idx_reminders_failed_payment
  ON reminders (failed_payment_id);
