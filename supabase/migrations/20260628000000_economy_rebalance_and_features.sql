-- =====================================================
-- ECONOMY REBALANCE + NEW FEATURES
-- =====================================================

-- 1. Atomic wallet credit (replaces non-atomic read-then-write)
CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_user_id UUID,
  p_cents INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    INSERT INTO public.wallets (user_id, available_cents) VALUES (p_user_id, p_cents)
    ON CONFLICT (user_id) DO UPDATE SET available_cents = public.wallets.available_cents + p_cents;
    RETURN;
  END IF;

  UPDATE public.wallets
  SET available_cents = available_cents + p_cents
  WHERE id = v_wallet_id;

  INSERT INTO public.wallet_transactions (wallet_id, user_id, type, amount_cents, description)
  VALUES (v_wallet_id, p_user_id, 'release', p_cents, 'Crédito automático');
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_wallet TO service_role;

-- =====================================================
-- 2. ECONOMY REBALANCE — Update get_user_rank with lower multipliers
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_user_rank(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  lifetime INT;
  rank_name TEXT;
  multiplier NUMERIC(3,1);
  result JSONB;
BEGIN
  SELECT lifetime_earned INTO lifetime
  FROM public.user_points
  WHERE user_id = p_user_id;

  IF lifetime IS NULL THEN lifetime := 0; END IF;

  IF lifetime >= 10000 THEN
    rank_name := 'Elite';     multiplier := 1.8;
  ELSIF lifetime >= 5000 THEN
    rank_name := 'Diamante';  multiplier := 1.5;
  ELSIF lifetime >= 2000 THEN
    rank_name := 'Ouro';      multiplier := 1.3;
  ELSIF lifetime >= 500 THEN
    rank_name := 'Prata';     multiplier := 1.15;
  ELSE
    rank_name := 'Bronze';    multiplier := 1.0;
  END IF;

  result := jsonb_build_object('rank', rank_name, 'multiplier', multiplier, 'lifetime_earned', lifetime);
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_rank TO service_role;

-- =====================================================
-- 3. UPDATE daily login reward to Bux Rewards (2 SP/day + streak bonuses)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_daily_reward(p_streak INT)
RETURNS INT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_streak >= 30 THEN RETURN 50;
  ELSIF p_streak >= 7 THEN RETURN 10;
  ELSE RETURN 2;
  END IF;
END;
$$;

-- =====================================================
-- 4. BADGES & TITLES SYSTEM
-- =====================================================
CREATE TABLE IF NOT EXISTS public.badge_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary', 'limited')),
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'season', 'event', 'achievement', 'founder', 'premium', 'community')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badge_definitions(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS public.title_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  display TEXT NOT NULL,
  description TEXT,
  rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary', 'limited')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title_id UUID NOT NULL REFERENCES public.title_definitions(id) ON DELETE CASCADE,
  equipped BOOLEAN NOT NULL DEFAULT false,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, title_id)
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS equipped_title_id UUID REFERENCES public.title_definitions(id) ON DELETE SET NULL;

-- =====================================================
-- 5. PROFILE COSMETICS (frames, backgrounds)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.cosmetic_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('frame', 'background', 'badge_frame', 'name_color')),
  image_url TEXT,
  rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary', 'limited')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_cosmetics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cosmetic_id UUID NOT NULL REFERENCES public.cosmetic_definitions(id) ON DELETE CASCADE,
  equipped BOOLEAN NOT NULL DEFAULT false,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, cosmetic_id)
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS equipped_frame_id UUID REFERENCES public.cosmetic_definitions(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS equipped_background_id UUID REFERENCES public.cosmetic_definitions(id) ON DELETE SET NULL;

-- =====================================================
-- 6. BUX PASS (Season Pass) foundation
-- =====================================================
CREATE TABLE IF NOT EXISTS public.bux_pass_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  season_number INT NOT NULL UNIQUE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  max_level INT NOT NULL DEFAULT 70,
  premium_price_sp INT NOT NULL DEFAULT 5000,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bux_pass_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.bux_pass_seasons(id) ON DELETE CASCADE,
  level INT NOT NULL CHECK (level >= 1),
  xp_required INT NOT NULL,
  free_reward_type TEXT,
  free_reward_id TEXT,
  free_reward_label TEXT,
  premium_reward_type TEXT,
  premium_reward_id TEXT,
  premium_reward_label TEXT,
  UNIQUE(season_id, level)
);

CREATE TABLE IF NOT EXISTS public.bux_pass_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES public.bux_pass_seasons(id) ON DELETE CASCADE,
  xp INT NOT NULL DEFAULT 0,
  level INT NOT NULL DEFAULT 1,
  has_premium BOOLEAN NOT NULL DEFAULT false,
  claimed_free_at TEXT[] NOT NULL DEFAULT '{}',
  claimed_premium_at TEXT[] NOT NULL DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, season_id)
);

-- XP activities for Bux Pass
CREATE TABLE IF NOT EXISTS public.bux_pass_xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  xp_amount INT NOT NULL,
  daily_limit INT NOT NULL DEFAULT 1,
  cooldown_hours INT DEFAULT 0
);

INSERT INTO public.bux_pass_xp_events (slug, label, xp_amount, daily_limit) VALUES
  ('daily_login',     'Login Diário',      10, 1),
  ('purchase',        'Compra',            25, 99),
  ('sale',            'Venda',             50, 99),
  ('review',          'Avaliação',         15, 1),
  ('script_upload',   'Upload de Script',  20, 3),
  ('script_like',     'Curtida Recebida',   5, 20)
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- 7. RLS policies for new tables
-- =====================================================
ALTER TABLE public.badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.title_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cosmetic_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_cosmetics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bux_pass_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bux_pass_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bux_pass_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bux_pass_xp_events ENABLE ROW LEVEL SECURITY;

-- Public read for definitions
CREATE POLICY "badge_definitions_public_read" ON public.badge_definitions FOR SELECT USING (true);
CREATE POLICY "title_definitions_public_read" ON public.title_definitions FOR SELECT USING (true);
CREATE POLICY "cosmetic_definitions_public_read" ON public.cosmetic_definitions FOR SELECT USING (true);
CREATE POLICY "bux_pass_seasons_public_read" ON public.bux_pass_seasons FOR SELECT USING (true);
CREATE POLICY "bux_pass_levels_public_read" ON public.bux_pass_levels FOR SELECT USING (true);
CREATE POLICY "bux_pass_xp_events_public_read" ON public.bux_pass_xp_events FOR SELECT USING (true);

-- Users read own badges/titles/cosmetics/progress
CREATE POLICY "user_badges_self" ON public.user_badges FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_badges_public" ON public.user_badges FOR SELECT USING (true);
CREATE POLICY "user_titles_self" ON public.user_titles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_cosmetics_self" ON public.user_cosmetics FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bux_pass_progress_self" ON public.bux_pass_progress FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Service role grants
GRANT ALL ON public.badge_definitions TO service_role;
GRANT ALL ON public.user_badges TO service_role;
GRANT ALL ON public.title_definitions TO service_role;
GRANT ALL ON public.user_titles TO service_role;
GRANT ALL ON public.cosmetic_definitions TO service_role;
GRANT ALL ON public.user_cosmetics TO service_role;
GRANT ALL ON public.bux_pass_seasons TO service_role;
GRANT ALL ON public.bux_pass_levels TO service_role;
GRANT ALL ON public.bux_pass_progress TO service_role;
GRANT ALL ON public.bux_pass_xp_events TO service_role;

GRANT SELECT ON public.badge_definitions TO anon, authenticated;
GRANT SELECT ON public.title_definitions TO anon, authenticated;
GRANT SELECT ON public.cosmetic_definitions TO anon, authenticated;
GRANT SELECT ON public.bux_pass_seasons TO anon, authenticated;
GRANT SELECT ON public.bux_pass_levels TO anon, authenticated;
GRANT SELECT ON public.bux_pass_xp_events TO anon, authenticated;
GRANT SELECT ON public.user_badges TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_badges TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_titles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_cosmetics TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.bux_pass_progress TO authenticated;

-- Insert founder badges for early users
INSERT INTO public.badge_definitions (slug, name, description, rarity, category) VALUES
  ('founder',        'Founder',        'Um dos primeiros membros da plataforma.',            'legendary', 'founder'),
  ('early_supporter','Early Supporter','Apoiou a BuxHub nos primeiros dias.',                'epic',      'founder'),
  ('season1_veteran','Season 1 Vet',   'Completou a primeira temporada do Bux Pass.',       'legendary', 'season'),
  ('bux_pioneer',    'Bux Pioneer',    'Ajudou a construir a comunidade desde o início.',    'epic',      'founder')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.title_definitions (slug, display, description, rarity) VALUES
  ('founder',    'Founder',     'Título de fundador.',   'legendary'),
  ('veteran',    'Veterano',    'Membro antigo da comunidade.', 'epic'),
  ('premium',    'Premium',     'Assinante Premium.',    'uncommon'),
  ('elite',      'Elite',       'Rank mais alto.',       'rare'),
  ('trader',     'Trader',      'Grande negociante.',    'uncommon')
ON CONFLICT (slug) DO NOTHING;
