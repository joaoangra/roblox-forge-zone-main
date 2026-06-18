-- BuxHub marketplace hardening: RBAC, listing approval, Smiley Store, stats and uploads.

-- Staff role expansion
DO $$ BEGIN
  ALTER TYPE public.staff_role ADD VALUE IF NOT EXISTS 'official_seller';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ticket status normalization requested by product scope.
-- Existing enum value waiting_user is kept for compatibility, but the app should stop writing it.

-- Listings approval metadata and prioritization
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ADD COLUMN IF NOT EXISTS is_vip BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promo_active BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_listings_priority
  ON public.listings(status, is_vip DESC, featured DESC, sales_count DESC, rating DESC);

CREATE TABLE IF NOT EXISTS public.listing_review_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.listing_status NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.listing_review_history TO authenticated;
GRANT ALL ON public.listing_review_history TO service_role;
ALTER TABLE public.listing_review_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listing_review_history_admin_read" ON public.listing_review_history;
CREATE POLICY "listing_review_history_admin_read" ON public.listing_review_history
  FOR SELECT USING (public.is_admin_staff() OR public.is_owner());

DROP POLICY IF EXISTS "listing_review_history_service_only" ON public.listing_review_history;
CREATE POLICY "listing_review_history_service_only" ON public.listing_review_history
  FOR ALL USING (false) WITH CHECK (false);

-- Smiley Store singleton/settings and ownership
CREATE TABLE IF NOT EXISTS public.smiley_store_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  banner_url TEXT,
  logo_url TEXT,
  promo_title TEXT,
  promo_description TEXT,
  promo_active BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.smiley_store_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS is_smiley_store BOOLEAN NOT NULL DEFAULT false;

GRANT SELECT ON public.smiley_store_settings TO anon, authenticated;
GRANT ALL ON public.smiley_store_settings TO service_role;
ALTER TABLE public.smiley_store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "smiley_settings_public_read" ON public.smiley_store_settings;
CREATE POLICY "smiley_settings_public_read" ON public.smiley_store_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "smiley_settings_staff_write" ON public.smiley_store_settings;
CREATE POLICY "smiley_settings_staff_write" ON public.smiley_store_settings FOR ALL
  USING (public.is_owner() OR public.has_staff_permission('shop.smiley.manage'))
  WITH CHECK (public.is_owner() OR public.has_staff_permission('shop.smiley.manage'));

-- Dynamic Roblox game categories
CREATE TABLE IF NOT EXISTS public.roblox_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.roblox_games TO authenticated;
GRANT SELECT ON public.roblox_games TO anon;
GRANT ALL ON public.roblox_games TO service_role;
ALTER TABLE public.roblox_games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roblox_games_public_read" ON public.roblox_games;
CREATE POLICY "roblox_games_public_read" ON public.roblox_games FOR SELECT USING (true);

DROP POLICY IF EXISTS "roblox_games_auth_insert" ON public.roblox_games;
CREATE POLICY "roblox_games_auth_insert" ON public.roblox_games
  FOR INSERT WITH CHECK (auth.uid() = created_by);

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS roblox_game_id UUID REFERENCES public.roblox_games(id) ON DELETE SET NULL;

-- Stats for views/clicks/shares
CREATE TABLE IF NOT EXISTS public.listing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'click', 'share', 'sale')),
  channel TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.listing_events TO anon, authenticated;
GRANT SELECT ON public.listing_events TO authenticated;
GRANT ALL ON public.listing_events TO service_role;
ALTER TABLE public.listing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listing_events_insert" ON public.listing_events;
CREATE POLICY "listing_events_insert" ON public.listing_events
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "listing_events_owner_admin_read" ON public.listing_events;
CREATE POLICY "listing_events_owner_admin_read" ON public.listing_events
  FOR SELECT USING (
    public.is_admin_staff()
    OR public.is_owner()
    OR EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id AND l.seller_id = auth.uid()
    )
  );

-- Storage buckets for product/store media
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('listing-media', 'listing-media', true),
  ('store-media', 'store-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "listing_media_public_read" ON storage.objects;
CREATE POLICY "listing_media_public_read" ON storage.objects
  FOR SELECT USING (bucket_id IN ('listing-media', 'store-media'));

DROP POLICY IF EXISTS "listing_media_seller_upload" ON storage.objects;
CREATE POLICY "listing_media_seller_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'listing-media'
    AND lower(right(name, 4)) IN ('.png', '.jpg', 'webp', 'jpeg')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "store_media_staff_upload" ON storage.objects;
CREATE POLICY "store_media_staff_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'store-media'
    AND (public.is_owner() OR public.has_staff_permission('shop.smiley.manage'))
  );

-- Policies for listings aligned with approval and role model
DROP POLICY IF EXISTS "lst_public" ON public.listings;
CREATE POLICY "lst_public" ON public.listings
  FOR SELECT USING (
    status = 'active'
    OR auth.uid() = seller_id
    OR public.is_admin_staff()
    OR public.is_owner()
  );

DROP POLICY IF EXISTS "lst_seller" ON public.listings;
CREATE POLICY "lst_seller" ON public.listings
  FOR ALL USING (auth.uid() = seller_id AND is_smiley_store = false)
  WITH CHECK (auth.uid() = seller_id AND is_smiley_store = false);

DROP POLICY IF EXISTS "lst_admin" ON public.listings;
CREATE POLICY "lst_admin" ON public.listings
  FOR ALL USING (public.is_owner() OR public.has_staff_permission('listings.approve'))
  WITH CHECK (public.is_owner() OR public.has_staff_permission('listings.approve'));

DROP POLICY IF EXISTS "lst_smiley_staff" ON public.listings;
CREATE POLICY "lst_smiley_staff" ON public.listings
  FOR ALL USING (
    is_smiley_store = true
    AND (public.is_owner() OR public.has_staff_permission('shop.smiley.manage'))
  )
  WITH CHECK (
    is_smiley_store = true
    AND (public.is_owner() OR public.has_staff_permission('shop.smiley.manage'))
  );
