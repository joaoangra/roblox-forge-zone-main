-- Migration: listing_options, moderation_logs, user_points, seller_verification_levels

-- 1. Listing options/variants
CREATE TABLE IF NOT EXISTS public.listing_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  price_adjustment_cents INT NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.listing_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listing_options_public_read" ON public.listing_options
  FOR SELECT USING (true);
CREATE POLICY "listing_options_seller_manage" ON public.listing_options
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.listings WHERE id = listing_id AND seller_id = auth.uid())
  );
CREATE POLICY "listing_options_admin_manage" ON public.listing_options
  FOR ALL USING (EXISTS (SELECT 1 FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));

GRANT SELECT ON public.listing_options TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.listing_options TO authenticated;
GRANT ALL ON public.listing_options TO service_role;

CREATE INDEX IF NOT EXISTS idx_listing_options_listing ON public.listing_options(listing_id);

-- 2. Moderation logs
CREATE TABLE IF NOT EXISTS public.moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "moderation_logs_admin_select" ON public.moderation_logs
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));
CREATE POLICY "moderation_logs_insert" ON public.moderation_logs
  FOR INSERT WITH CHECK (true);

GRANT SELECT, INSERT ON public.moderation_logs TO authenticated;
GRANT ALL ON public.moderation_logs TO service_role;

CREATE INDEX IF NOT EXISTS idx_moderation_logs_target ON public.moderation_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_created ON public.moderation_logs(created_at DESC);

-- 3. User points
CREATE TABLE IF NOT EXISTS public.user_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INT NOT NULL DEFAULT 0,
  lifetime_earned INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_points_self_read" ON public.user_points
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user_points_self_update" ON public.user_points
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "user_points_admin_all" ON public.user_points
  FOR ALL USING (EXISTS (SELECT 1 FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));

GRANT SELECT ON public.user_points TO authenticated;
GRANT ALL ON public.user_points TO service_role;

-- 4. Point transactions
CREATE TABLE IF NOT EXISTS public.point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  reason TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "point_transactions_self_read" ON public.point_transactions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "point_transactions_admin_all" ON public.point_transactions
  FOR ALL USING (EXISTS (SELECT 1 FROM public.staff_members WHERE user_id = auth.uid() AND is_active = true));

GRANT SELECT ON public.point_transactions TO authenticated;
GRANT ALL ON public.point_transactions TO service_role;

CREATE INDEX IF NOT EXISTS idx_point_transactions_user ON public.point_transactions(user_id, created_at DESC);

-- 5. Add seller_verification_status to seller_profiles
ALTER TABLE public.seller_profiles
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'none'
  CHECK (verification_status IN ('none', 'pending', 'verified', 'rejected'));

-- 6. Add premium_seller fields to listings for badge display
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS is_premium_seller BOOLEAN NOT NULL DEFAULT false;

-- Trigger: auto-set is_premium_seller on listing insert/update
CREATE OR REPLACE FUNCTION public.set_listing_premium_seller()
RETURNS TRIGGER AS $$
BEGIN
  SELECT is_premium INTO NEW.is_premium_seller
  FROM public.profiles WHERE id = NEW.seller_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_listings_set_premium ON public.listings;
CREATE TRIGGER trg_listings_set_premium
  BEFORE INSERT OR UPDATE OF seller_id ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.set_listing_premium_seller();

-- 7. Function to award points
CREATE OR REPLACE FUNCTION public.award_points(
  p_user_id UUID,
  p_amount INT,
  p_reason TEXT,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_points (user_id, balance, lifetime_earned)
  VALUES (p_user_id, p_amount, p_amount)
  ON CONFLICT (user_id)
  DO UPDATE SET
    balance = public.user_points.balance + p_amount,
    lifetime_earned = public.user_points.lifetime_earned + GREATEST(p_amount, 0),
    updated_at = now();

  INSERT INTO public.point_transactions (user_id, amount, reason, reference_type, reference_id)
  VALUES (p_user_id, p_amount, p_reason, p_reference_type, p_reference_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_points TO service_role;

-- 8. Function to auto-moderate content
CREATE OR REPLACE FUNCTION public.check_moderation_content(content TEXT)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  blocked_patterns TEXT[] := ARRAY[
    'discord\s*\.', 'discord\.gg', 'discordapp\.',
    't\.me\/', 'telegram\.', 'wa\.me\/', 'whatsapp\.com',
    'instagram\.', 'insta\.com',
    'bit\.ly', 'tinyurl', 'shorturl',
    'compre\s*por\s*fora', 'fora\s*da\s*plataforma',
    'me\s*chama\s*no', 'me\s*adiciona\s*no',
    'te\s*faço\s*mais\s*barato',
    'chama\s*no\s*privado', 'chama\s*no\s*pv'
  ];
  matched TEXT;
  result JSONB := '{"blocked": false, "matched": null}'::JSONB;
BEGIN
  IF content IS NULL THEN
    RETURN result;
  END IF;

  SELECT pattern INTO matched
  FROM unnest(blocked_patterns) AS pattern
  WHERE content ~* pattern
  LIMIT 1;

  IF matched IS NOT NULL THEN
    result := jsonb_build_object('blocked', true, 'matched', matched);
  END IF;

  RETURN result;
END;
$$;

-- 9. Auto-create user_points on profile creation
CREATE OR REPLACE FUNCTION public.ensure_points_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_points (user_id, balance, lifetime_earned)
  VALUES (NEW.id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_profile_create_points ON public.profiles;
CREATE TRIGGER trg_profile_create_points
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ensure_points_for_user();

-- 10. Auto-moderation trigger for listing_questions
CREATE OR REPLACE FUNCTION public.moderation_check_question()
RETURNS TRIGGER AS $$
DECLARE
  check_result JSONB;
BEGIN
  check_result := public.check_moderation_content(NEW.question);
  IF (check_result->>'blocked')::boolean THEN
    INSERT INTO public.moderation_logs (actor_id, target_type, target_id, action, reason, metadata)
    VALUES (NEW.user_id, 'listing_question', NEW.id::text, 'blocked',
      'Conteudo bloqueado: ' || (check_result->>'matched'),
      jsonb_build_object('question', NEW.question, 'pattern', check_result->>'matched'));
    RAISE EXCEPTION 'Mensagem bloqueada pela seguranca. Por seguranca, toda negociacao deve acontecer dentro da BuxHub.'
      USING HINT = 'blocked_pattern';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_moderation_question ON public.listing_questions;
CREATE TRIGGER trg_moderation_question
  BEFORE INSERT ON public.listing_questions
  FOR EACH ROW EXECUTE FUNCTION public.moderation_check_question();

-- 11. Auto-moderation trigger for marketplace chat messages
CREATE OR REPLACE FUNCTION public.moderation_check_chat()
RETURNS TRIGGER AS $$
DECLARE
  check_result JSONB;
BEGIN
  IF NEW.system_message THEN
    RETURN NEW;
  END IF;
  IF NEW.body IS NOT NULL THEN
    check_result := public.check_moderation_content(NEW.body);
    IF (check_result->>'blocked')::boolean THEN
      INSERT INTO public.moderation_logs (actor_id, target_type, target_id, action, reason, metadata)
      VALUES (NEW.sender_id, 'chat_message', NEW.id::text, 'blocked',
        'Conteudo bloqueado: ' || (check_result->>'matched'),
        jsonb_build_object('body', NEW.body, 'pattern', check_result->>'matched'));
      RAISE EXCEPTION 'Mensagem bloqueada pela seguranca. Por seguranca, toda negociacao deve acontecer dentro da BuxHub.'
        USING HINT = 'blocked_pattern';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_moderation_chat ON public.marketplace_chat_messages;
CREATE TRIGGER trg_moderation_chat
  BEFORE INSERT ON public.marketplace_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.moderation_check_chat();
