ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tickets_archived_at ON public.tickets(archived_at);
CREATE INDEX IF NOT EXISTS idx_tickets_user_archived ON public.tickets(user_id, archived_at);
