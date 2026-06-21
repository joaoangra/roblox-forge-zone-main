-- =====================================================
-- REBRAND: Smiley → Bux
-- Renames DB objects from "smiley" to "bux"
-- Fully idempotent — safe to run multiple times
-- =====================================================

-- 1. RENAME TABLE (only if old name still exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'smiley_store_settings'
  ) THEN
    ALTER TABLE public.smiley_store_settings RENAME TO bux_store_settings;
  END IF;
END $$;

-- 2. RENAME COLUMNS (only if old column names still exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'is_smiley_store'
  ) THEN
    ALTER TABLE public.listings RENAME COLUMN is_smiley_store TO is_bux_store;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'smiley_points'
  ) THEN
    ALTER TABLE public.profiles RENAME COLUMN smiley_points TO bux_points;
  END IF;
END $$;

-- 3. RENAME POLICIES (drop old + new names, then recreate)
DROP POLICY IF EXISTS "smiley_settings_public_read" ON public.bux_store_settings;
DROP POLICY IF EXISTS "smiley_settings_staff_write" ON public.bux_store_settings;
DROP POLICY IF EXISTS "bux_settings_public_read" ON public.bux_store_settings;
DROP POLICY IF EXISTS "bux_settings_staff_write" ON public.bux_store_settings;

CREATE POLICY "bux_settings_public_read" ON public.bux_store_settings FOR SELECT USING (true);
CREATE POLICY "bux_settings_staff_write" ON public.bux_store_settings FOR ALL
  USING (public.is_owner() OR public.has_staff_permission('shop.bux.manage'))
  WITH CHECK (public.is_owner() OR public.has_staff_permission('shop.bux.manage'));

DROP POLICY IF EXISTS "lst_smiley_staff" ON public.listings;
DROP POLICY IF EXISTS "lst_smiley_manage" ON public.listings;
DROP POLICY IF EXISTS "lst_bux_staff" ON public.listings;

CREATE POLICY "lst_bux_staff" ON public.listings
  FOR ALL
  USING (
    is_bux_store = true
    AND (public.is_owner() OR public.has_staff_permission('shop.bux.manage'))
  )
  WITH CHECK (
    is_bux_store = true
    AND (public.is_owner() OR public.has_staff_permission('shop.bux.manage'))
  );

-- 4. UPDATE EXISTING PERMISSION STRINGS IN STAFF_MEMBERS (permissions array)
UPDATE public.staff_members
SET permissions = array_replace(permissions, 'shop.smiley.manage', 'shop.bux.manage')
WHERE permissions @> ARRAY['shop.smiley.manage'];

-- 5. UPDATE STORED DATA (promo banners, descriptions, etc.) — all variants → "Bux Store"
UPDATE public.bux_store_settings
SET promo_title = REPLACE(REPLACE(REPLACE(promo_title,
  'Smiley Store', 'Bux Store'),
  'Smiley Shop', 'Bux Store'),
  'Loja Smiley', 'Bux Store'),
    promo_description = REPLACE(REPLACE(REPLACE(promo_description,
  'Smiley Store', 'Bux Store'),
  'Smiley Shop', 'Bux Store'),
  'Loja Smiley', 'Bux Store')
WHERE promo_title ~* 'smiley (store|shop)|loja smiley'
   OR promo_description ~* 'smiley (store|shop)|loja smiley';

-- 6. ALSO update any listing titles/descriptions that mention old names
UPDATE public.listings
SET title = REPLACE(REPLACE(REPLACE(title,
  'Smiley Store', 'Bux Store'),
  'Smiley Shop', 'Bux Store'),
  'Loja Smiley', 'Bux Store'),
    description = REPLACE(REPLACE(REPLACE(description,
  'Smiley Store', 'Bux Store'),
  'Smiley Shop', 'Bux Store'),
  'Loja Smiley', 'Bux Store')
WHERE title ~* 'smiley (store|shop)|loja smiley'
   OR description ~* 'smiley (store|shop)|loja smiley';

-- 7. GRANTS for renamed table
GRANT SELECT ON public.bux_store_settings TO anon, authenticated;
GRANT ALL ON public.bux_store_settings TO service_role;
ALTER TABLE public.bux_store_settings ENABLE ROW LEVEL SECURITY;
