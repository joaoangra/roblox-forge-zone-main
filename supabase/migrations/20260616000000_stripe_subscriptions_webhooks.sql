-- ============================================================
-- STRIPE SUBSCRIPTION MANAGEMENT & WEBHOOK IDEMPOTENCY
-- ============================================================

-- 1. Add subscription columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT CHECK (subscription_status IN ('active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'trialing', 'paused')),
  ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ;

-- 2. Create webhook_events table for idempotency
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Webhook events are only accessed by service_role (backend)
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Grant access to service_role only
GRANT ALL ON public.webhook_events TO service_role;
GRANT SELECT ON public.webhook_events TO authenticated;

-- Policies
CREATE POLICY "webhook_events_service_all" ON public.webhook_events
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "webhook_events_auth_select" ON public.webhook_events
  FOR SELECT USING (auth.role() = 'authenticated');

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_webhook_events_id ON public.webhook_events (id);