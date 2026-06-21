-- Payment Engine Fixes + Missing Indexes
-- Migration 20260621000000

-- 1. Fix fraud engine: update check_prior_disputes to also check the actual `disputes` table
CREATE OR REPLACE FUNCTION check_prior_disputes(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_disputes INTEGER := 0;
  v_chargebacks INTEGER := 0;
  v_score INTEGER := 0;
BEGIN
  -- Check disputes table (actual dispute resolution)
  BEGIN
    SELECT COUNT(*) INTO v_disputes
    FROM disputes
    WHERE order_id IN (SELECT id FROM marketplace_orders WHERE buyer_id = p_user_id OR seller_id = p_user_id)
      AND status IN ('resolved_buyer', 'resolved_seller');
  EXCEPTION WHEN undefined_table THEN
    v_disputes := 0;
  END;

  -- Check for cancelled/refunded orders as fraud indicators
  BEGIN
    SELECT COUNT(*) INTO v_chargebacks
    FROM marketplace_orders
    WHERE (buyer_id = p_user_id OR seller_id = p_user_id)
      AND status IN ('refunded', 'cancelled');
  EXCEPTION WHEN undefined_table THEN
    v_chargebacks := 0;
  END;

  IF v_disputes > 0 THEN v_score := v_score + 20; END IF;
  IF v_chargebacks >= 3 THEN v_score := v_score + 30; END IF;

  RETURN v_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Add missing indexes for payment performance
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_buyer_status ON marketplace_orders(buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_seller_status ON marketplace_orders(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_listing_status ON transactions(listing_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_release_at ON transactions(status, release_at) WHERE status = 'held';
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_type ON wallet_transactions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dispute_messages_dispute ON dispute_messages(dispute_id, created_at);

-- 3. Add unique constraint on order_id for disputes (one dispute per order)
ALTER TABLE disputes DROP CONSTRAINT IF EXISTS disputes_order_id_key;
ALTER TABLE disputes ADD CONSTRAINT disputes_order_id_key UNIQUE (order_id);

-- 4. Function to update wallet pending balance when order is paid
CREATE OR REPLACE FUNCTION update_wallet_on_order_paid()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'paid' AND OLD.status = 'awaiting_payment' THEN
    -- Add seller amount to wallet pending balance
    UPDATE wallets
    SET pending_cents = pending_cents + NEW.seller_amount_cents
    WHERE user_id = NEW.seller_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_wallet_on_order_paid ON marketplace_orders;
CREATE TRIGGER trg_update_wallet_on_order_paid
  AFTER UPDATE OF status ON marketplace_orders
  FOR EACH ROW
  WHEN (NEW.status = 'paid')
  EXECUTE FUNCTION update_wallet_on_order_paid();

-- 6. Function to revert pending on refund
CREATE OR REPLACE FUNCTION update_wallet_on_order_refunded()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'refunded' AND OLD.status IN ('paid', 'delivered') THEN
    UPDATE wallets
    SET pending_cents = GREATEST(pending_cents - NEW.seller_amount_cents, 0)
    WHERE user_id = NEW.seller_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_wallet_on_order_refunded ON marketplace_orders;
CREATE TRIGGER trg_update_wallet_on_order_refunded
  AFTER UPDATE OF status ON marketplace_orders
  FOR EACH ROW
  WHEN (NEW.status = 'refunded')
  EXECUTE FUNCTION update_wallet_on_order_refunded();
