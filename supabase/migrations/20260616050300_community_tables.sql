-- Create community tables that were missing from migrations
-- These tables are referenced by index.tsx and community.tsx

-- ============ ANNOUNCEMENTS ============
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    active BOOLEAN NOT NULL DEFAULT true,
    important BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "ann_public_read" ON public.announcements FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "ann_admin_write" ON public.announcements FOR ALL
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============ COMMUNITY ADS ============
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.community_ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'service',
    description TEXT NOT NULL,
    contact TEXT,
    status TEXT NOT NULL DEFAULT 'pending_review',
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

GRANT SELECT ON public.community_ads TO anon;
GRANT SELECT, INSERT ON public.community_ads TO authenticated;
GRANT ALL ON public.community_ads TO service_role;
ALTER TABLE public.community_ads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "ca_public_read" ON public.community_ads FOR SELECT
    USING (status = 'approved' OR auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "ca_user_insert" ON public.community_ads FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "ca_admin_all" ON public.community_ads FOR ALL
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;