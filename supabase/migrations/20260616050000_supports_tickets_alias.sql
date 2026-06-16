-- Compatibility layer for legacy code expecting `public.supports_tickets`.
-- Maps it to the current `public.tickets` schema.

-- If you already have this object, do nothing.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'supports_tickets'
  ) THEN
    -- Object exists; do nothing.
    NULL;
  ELSE
    -- Create a view that exposes tickets under the expected name.
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

