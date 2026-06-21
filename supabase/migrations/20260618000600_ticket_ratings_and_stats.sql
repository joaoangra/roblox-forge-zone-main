-- ============================================================
-- BuxHub - Ticket Ratings, Assignment & Staff Stats
-- ============================================================

-- 1. Add assigned_to column to tickets
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);

-- 2. Create ticket_ratings table
CREATE TABLE IF NOT EXISTS public.ticket_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ticket_id)
);

ALTER TABLE public.ticket_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "ticket_ratings_select" ON public.ticket_ratings FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() = staff_id
    OR public.is_staff()
  );

CREATE POLICY IF NOT EXISTS "ticket_ratings_insert" ON public.ticket_ratings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.ticket_ratings TO authenticated;
GRANT ALL ON public.ticket_ratings TO service_role;
