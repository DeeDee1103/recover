-- Unique constraint for end_customer upsert (merchant + stripe customer)
ALTER TABLE end_customers
  ADD CONSTRAINT end_customers_merchant_stripe_customer_unique
  UNIQUE (merchant_id, stripe_customer_id);

-- Unique constraint for stripe_connections upsert (one connection per merchant)
ALTER TABLE stripe_connections
  ADD CONSTRAINT stripe_connections_merchant_unique
  UNIQUE (merchant_id);
