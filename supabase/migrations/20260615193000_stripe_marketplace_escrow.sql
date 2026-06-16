ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
  ADD COLUMN IF NOT EXISTS is_seller BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seller_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS buyer_strikes INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE RESTRICT,
  marketplace_order_id UUID UNIQUE REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  platform_fee_cents INT NOT NULL DEFAULT 0 CHECK (platform_fee_cents >= 0),
  seller_amount_cents INT NOT NULL CHECK (seller_amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'brl',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','held','disputed','released','refunded','cancelled')),
  release_at TIMESTAMPTZ NOT NULL,
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_transfer_id TEXT,
  stripe_refund_id TEXT,
  disputed_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_buyer ON public.transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_seller ON public.transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status_release ON public.transactions(status, release_at);
CREATE INDEX IF NOT EXISTS idx_transactions_order ON public.transactions(marketplace_order_id);

GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tx_parties_read" ON public.transactions;
CREATE POLICY "tx_parties_read" ON public.transactions FOR SELECT
  USING (auth.uid() IN (buyer_id, seller_id) OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "tx_admin_all" ON public.transactions;
CREATE POLICY "tx_admin_all" ON public.transactions FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS trg_transactions_upd ON public.transactions;
CREATE TRIGGER trg_transactions_upd
BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "mo_update" ON public.marketplace_orders;
CREATE POLICY "mo_admin_update" ON public.marketplace_orders FOR UPDATE
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "cr_insert" ON public.marketplace_chat_rooms;
CREATE POLICY "cr_admin_insert" ON public.marketplace_chat_rooms FOR INSERT
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "cm_send" ON public.marketplace_chat_messages;
CREATE POLICY "cm_send" ON public.marketplace_chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND system_message = false
    AND EXISTS (
      SELECT 1 FROM public.marketplace_chat_rooms r
      WHERE r.id = room_id AND auth.uid() IN (r.buyer_id, r.seller_id)
    )
  );

CREATE POLICY "cm_admin_send" ON public.marketplace_chat_messages FOR INSERT
  WITH CHECK (public.has_role(auth.uid(),'admin'));
