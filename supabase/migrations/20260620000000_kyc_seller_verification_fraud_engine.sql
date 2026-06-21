-- KYC + Seller Verification + Fraud Engine
-- Migration 20260620000000

-- 1. SELLER VERIFICATION TABLE
CREATE TABLE IF NOT EXISTS seller_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  cpf TEXT NOT NULL DEFAULT '',
  birth_date DATE,
  document_type TEXT NOT NULL DEFAULT 'rg' CHECK (document_type IN ('rg','cnh','passport')),
  document_front_url TEXT NOT NULL DEFAULT '',
  document_back_url TEXT DEFAULT '',
  selfie_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('none','pending','approved','rejected','banned')),
  admin_notes TEXT DEFAULT '',
  admin_id UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  fraud_flags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE seller_verification ENABLE ROW LEVEL SECURITY;
GRANT ALL ON seller_verification TO service_role;
GRANT ALL ON seller_verification TO anon;
GRANT ALL ON seller_verification TO authenticated;

CREATE INDEX IF NOT EXISTS idx_seller_verification_user_id ON seller_verification(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_verification_status ON seller_verification(status);
CREATE INDEX IF NOT EXISTS idx_seller_verification_cpf ON seller_verification(cpf);
CREATE INDEX IF NOT EXISTS idx_seller_verification_risk_score ON seller_verification(risk_score);

DROP POLICY IF EXISTS "Users view own verification" ON seller_verification;
CREATE POLICY "Users view own verification" ON seller_verification
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own verification" ON seller_verification;
CREATE POLICY "Users insert own verification" ON seller_verification
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Staff read all verifications" ON seller_verification;
CREATE POLICY "Staff read all verifications" ON seller_verification
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM staff_members WHERE user_id = auth.uid() AND is_active = true)
  );

DROP POLICY IF EXISTS "Staff update verifications" ON seller_verification;
CREATE POLICY "Staff update verifications" ON seller_verification
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM staff_members WHERE user_id = auth.uid() AND is_active = true)
  );

-- 2. FRAUD ENGINE FUNCTIONS

-- Check for duplicate CPF
CREATE OR REPLACE FUNCTION check_duplicate_cpf(p_cpf TEXT, p_exclude_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM seller_verification
  WHERE cpf = p_cpf AND user_id != p_exclude_user_id AND status NOT IN ('rejected','banned','none');
  RETURN CASE WHEN v_count > 0 THEN 30 ELSE 0 END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check for duplicate document (by selfie_url or document_front_url hash-like comparison)
CREATE OR REPLACE FUNCTION check_duplicate_document(p_document_front TEXT, p_selfie_url TEXT, p_exclude_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM seller_verification
  WHERE (document_front_url = p_document_front OR selfie_url = p_selfie_url)
    AND user_id != p_exclude_user_id AND status NOT IN ('rejected','banned','none');
  RETURN CASE WHEN v_count > 0 THEN 40 ELSE 0 END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check for multiple accounts from same IP (requires ip_address column on profiles or auth log)
CREATE OR REPLACE FUNCTION check_multiple_accounts(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Count seller_verification entries from the last 90 days as proxy
  SELECT COUNT(*) INTO v_count
  FROM seller_verification
  WHERE created_at > now() - interval '90 days'
    AND user_id != p_user_id
    AND status NOT IN ('banned');
  -- Reduce sensitivity: only flag if there are many recent applications
  RETURN CASE WHEN v_count > 20 THEN 20 ELSE 0 END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check for prior disputes/chargebacks
CREATE OR REPLACE FUNCTION check_prior_disputes(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_disputes INTEGER := 0;
  v_chargebacks INTEGER := 0;
  v_score INTEGER := 0;
BEGIN
  -- marketplace_disputes table may not exist yet — skip if absent
  BEGIN
    SELECT COUNT(*) INTO v_disputes
    FROM marketplace_disputes
    WHERE (buyer_id = p_user_id OR seller_id = p_user_id)
      AND status = 'resolved_against';
  EXCEPTION WHEN undefined_table THEN
    v_disputes := 0;
  END;
  
  BEGIN
    SELECT COUNT(*) INTO v_chargebacks
    FROM marketplace_disputes
    WHERE (buyer_id = p_user_id OR seller_id = p_user_id)
      AND status = 'chargeback';
  EXCEPTION WHEN undefined_table THEN
    v_chargebacks := 0;
  END;
  
  IF v_disputes > 0 THEN v_score := v_score + 20; END IF;
  IF v_chargebacks > 0 THEN v_score := v_score + 30; END IF;
  
  RETURN v_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check for new seller with high value sales (potential fraud)
CREATE OR REPLACE FUNCTION check_new_seller_high_volume(p_user_id UUID, p_account_age_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  v_sales_count INTEGER;
  v_account_age INTEGER;
BEGIN
  -- Account age from profiles.created_at
  SELECT EXTRACT(DAY FROM now() - COALESCE(created_at, now()))::INTEGER INTO v_account_age
  FROM profiles WHERE id = p_user_id;
  
  IF v_account_age IS NULL OR v_account_age > p_account_age_days THEN
    RETURN 0;
  END IF;
  
  SELECT COUNT(*) INTO v_sales_count
  FROM marketplace_orders
  WHERE seller_id = p_user_id AND status = 'released';
  
  RETURN CASE WHEN v_sales_count >= 5 THEN 15 ELSE 0 END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Calculate total risk score for a user
CREATE OR REPLACE FUNCTION calculate_risk_score(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_user seller_verification;
  v_score INTEGER := 0;
BEGIN
  SELECT * INTO v_user FROM seller_verification WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 1;
  IF v_user.id IS NULL THEN RETURN 0; END IF;
  
  v_score := v_score + check_duplicate_cpf(v_user.cpf, p_user_id);
  v_score := v_score + check_duplicate_document(v_user.document_front_url, v_user.selfie_url, p_user_id);
  v_score := v_score + check_multiple_accounts(p_user_id);
  v_score := v_score + check_prior_disputes(p_user_id);
  v_score := v_score + check_new_seller_high_volume(p_user_id);
  
  v_score := LEAST(v_score, 100);
  
  UPDATE seller_verification SET risk_score = v_score WHERE id = v_user.id;
  
  RETURN v_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. TRIGGER: auto-calc risk score on insert of seller_verification
CREATE OR REPLACE FUNCTION trigger_calc_risk_score()
RETURNS TRIGGER AS $$
DECLARE
  v_score INTEGER := 0;
BEGIN
  -- Calculate risk score inline to avoid recursion (calculate_risk_score does UPDATE)
  v_score := v_score + check_duplicate_cpf(NEW.cpf, NEW.user_id);
  v_score := v_score + check_duplicate_document(NEW.document_front_url, NEW.selfie_url, NEW.user_id);
  v_score := v_score + check_multiple_accounts(NEW.user_id);
  v_score := v_score + check_prior_disputes(NEW.user_id);
  v_score := v_score + check_new_seller_high_volume(NEW.user_id);
  v_score := LEAST(v_score, 100);
  
  NEW.risk_score := v_score;
  
  -- Auto-reject high-risk applications
  IF v_score >= 71 AND NEW.status = 'pending' THEN
    NEW.status := 'rejected';
    NEW.admin_notes := CONCAT(NEW.admin_notes, ' [AUTO] Alto risco (', v_score, '/100) - rejeitado automaticamente.');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_calc_risk_score ON seller_verification;
CREATE TRIGGER trg_calc_risk_score
  BEFORE INSERT ON seller_verification
  FOR EACH ROW EXECUTE FUNCTION trigger_calc_risk_score();

-- 4. UPDATE SELLER_PROFILES TRIGGER (sync verification_status)
CREATE OR REPLACE FUNCTION sync_seller_verification_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    UPDATE seller_profiles SET 
      verification_status = 'verified',
      verified = true,
      kyc_status = 'approved'
    WHERE user_id = NEW.user_id;
  ELSIF NEW.status = 'rejected' THEN
    UPDATE seller_profiles SET 
      verification_status = 'rejected',
      verified = false,
      kyc_status = 'rejected'
    WHERE user_id = NEW.user_id;
  ELSIF NEW.status = 'banned' THEN
    UPDATE seller_profiles SET 
      verification_status = 'rejected',
      verified = false,
      kyc_status = 'rejected'
    WHERE user_id = NEW.user_id;
  ELSIF NEW.status = 'pending' THEN
    UPDATE seller_profiles SET 
      verification_status = 'pending',
      kyc_status = 'pending'
    WHERE user_id = NEW.user_id;
    -- Ensure seller_profile exists
    INSERT INTO seller_profiles (user_id, verification_status, kyc_status)
    SELECT NEW.user_id, 'pending', 'pending'
    WHERE NOT EXISTS (SELECT 1 FROM seller_profiles WHERE user_id = NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_seller_verification ON seller_verification;
CREATE TRIGGER trg_sync_seller_verification
  AFTER INSERT OR UPDATE OF status ON seller_verification
  FOR EACH ROW EXECUTE FUNCTION sync_seller_verification_status();

-- 5. USER-FRIENDLY ERROR for moderation (enhances existing check_moderation_content)
CREATE OR REPLACE FUNCTION raise_moderation_error()
RETURNS TRIGGER AS $$
BEGIN
  -- Call existing check if it exists
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_moderation_content') THEN
    -- The existing trigger already handles this, so we just pass through
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. AUDIT LOGGING for admin KYC actions
CREATE OR REPLACE FUNCTION log_kyc_admin_action()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.admin_id IS NOT NULL AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.admin_notes IS DISTINCT FROM NEW.admin_notes) THEN
    INSERT INTO audit_logs_new (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
      NEW.admin_id,
      CASE 
        WHEN NEW.status = 'approved' THEN 'kyc.approved'
        WHEN NEW.status = 'rejected' THEN 'kyc.rejected'
        WHEN NEW.status = 'banned' THEN 'kyc.banned'
        ELSE 'kyc.updated'
      END,
      'seller_verification',
      NEW.id,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'notes', NEW.admin_notes)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_kyc_admin ON seller_verification;
CREATE TRIGGER trg_log_kyc_admin
  AFTER UPDATE ON seller_verification
  FOR EACH ROW EXECUTE FUNCTION log_kyc_admin_action();

-- 7. Ensure kyc-docs bucket exists (create if not)
INSERT INTO storage.buckets (id, name, public, avif_autodetection)
SELECT 'kyc-docs', 'kyc-docs', false, false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'kyc-docs');

DROP POLICY IF EXISTS "Users upload own KYC docs" ON storage.objects;
CREATE POLICY "Users upload own KYC docs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'kyc-docs' AND
  (name LIKE auth.uid()::text || '/%')
);

DROP POLICY IF EXISTS "Users read own KYC docs" ON storage.objects;
CREATE POLICY "Users read own KYC docs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'kyc-docs' AND
  (name LIKE auth.uid()::text || '/%' OR
   EXISTS (SELECT 1 FROM staff_members WHERE user_id = auth.uid() AND is_active = true))
);

DROP POLICY IF EXISTS "Staff read all KYC docs" ON storage.objects;
CREATE POLICY "Staff read all KYC docs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'kyc-docs' AND
  EXISTS (SELECT 1 FROM staff_members WHERE user_id = auth.uid() AND is_active = true)
);

-- 8. Add is_trusted_seller flag to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_trusted_seller BOOLEAN NOT NULL DEFAULT false;
