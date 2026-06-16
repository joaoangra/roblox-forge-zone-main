-- Legacy compatibility: some parts of the project expect `public.support_tickets`
-- and/or `public.supports_tickets`.
--
-- Current schema (from repo migrations) uses:
--   public.tickets
--   public.ticket_messages
--
-- This migration creates views with the legacy names if they do not exist.

-- support_tickets <-> tickets
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'support_tickets'
  ) THEN
    NULL;
  ELSE
    CREATE OR REPLACE VIEW public.support_tickets AS
    SELECT
      id,
      user_id,
      category,
      subject,
      status,
      related_order_id,
      assigned_to,
      created_at,
      updated_at
    FROM public.tickets;
  END IF;
END $$;

-- supports_tickets <-> tickets
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'supports_tickets'
  ) THEN
    NULL;
  ELSE
    CREATE OR REPLACE VIEW public.supports_tickets AS
    SELECT
      id,
      user_id,
      category,
      subject,
      status,
      related_order_id,
      assigned_to,
      created_at,
      updated_at
    FROM public.tickets;
  END IF;
END $$;

