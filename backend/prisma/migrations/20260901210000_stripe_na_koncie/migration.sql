-- Powiązanie konta z kartoteką w Stripe.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_customer_id"     TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_status"          TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_stripe_customer_id_key"
  ON "users"("stripe_customer_id");
