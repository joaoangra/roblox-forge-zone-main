-- ============================================================
-- BuxHub - Add FK constraints from child tables to profiles(id)
-- This enables PostgREST to resolve embedded joins on profiles
-- ============================================================

-- tickets.user_id -> profiles.id
DO $$ BEGIN
  ALTER TABLE public.tickets
    ADD CONSTRAINT tickets_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ticket_messages.sender_id -> profiles.id
DO $$ BEGIN
  ALTER TABLE public.ticket_messages
    ADD CONSTRAINT ticket_messages_sender_id_profiles_fkey
    FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- audit_logs_new.actor_id -> profiles.id
DO $$ BEGIN
  ALTER TABLE public.audit_logs_new
    ADD CONSTRAINT audit_logs_new_actor_id_profiles_fkey
    FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- staff_members.user_id -> profiles.id
DO $$ BEGIN
  ALTER TABLE public.staff_members
    ADD CONSTRAINT staff_members_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- listings.seller_id -> profiles.id (for bux store + regular listings)
DO $$ BEGIN
  ALTER TABLE public.listings
    ADD CONSTRAINT listings_seller_id_profiles_fkey
    FOREIGN KEY (seller_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
