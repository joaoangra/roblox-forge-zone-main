-- ============================================================
-- BuxHub - Fix Owner Access + RBAC Final Consolidation
-- ============================================================

-- ============ 1. ENSURE staff_role ENUM HAS ALL VALUES ============
DO $$
DECLARE
  _enum_id OID;
  _existing TEXT[];
BEGIN
  SELECT t.oid INTO _enum_id
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE t.typname = 'staff_role' AND n.nspname = 'public';

  IF _enum_id IS NULL THEN
    CREATE TYPE public.staff_role AS ENUM ('owner', 'admin', 'moderator', 'staff', 'support', 'helper', 'official_seller', 'seller');
    RETURN;
  END IF;

  SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder) INTO _existing
  FROM pg_enum e WHERE e.enumtypid = _enum_id;

  RAISE NOTICE 'Existing staff_role enum values: %', _existing;

  IF NOT (_existing @> ARRAY['admin']) THEN ALTER TYPE public.staff_role ADD VALUE 'admin' BEFORE 'moderator'; END IF;
  IF NOT (_existing @> ARRAY['staff']) THEN ALTER TYPE public.staff_role ADD VALUE 'staff' AFTER 'moderator'; END IF;
  IF NOT (_existing @> ARRAY['helper']) THEN ALTER TYPE public.staff_role ADD VALUE 'helper' AFTER 'support'; END IF;
  IF NOT (_existing @> ARRAY['official_seller']) THEN ALTER TYPE public.staff_role ADD VALUE 'official_seller' AFTER 'seller'; END IF;
END $$;

-- ============ 2. ENSURE app_role ENUM HAS seller ============
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'seller';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============ 3. SEED OWNER INTO staff_members ============
DO $$
DECLARE
  _owner_id UUID := '06c88cf0-978a-4568-a268-9902386ed121';
BEGIN
  INSERT INTO public.staff_members (user_id, role, permissions, granted_by, is_active)
  VALUES (
    _owner_id,
    'owner',
    ARRAY['*'],
    _owner_id,
    true
  )
  ON CONFLICT (user_id) DO UPDATE
  SET role = 'owner',
      permissions = ARRAY['*'],
      is_active = true,
      revoked_at = NULL;
END $$;

-- ============ 4. CONSOLIDATED RLS FUNCTIONS ============

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = _role::text
  );
$$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE user_id = auth.uid() AND role = 'owner' AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE user_id = auth.uid() AND is_active = true
  ) OR public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin_staff()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE user_id = auth.uid()
      AND is_active = true
      AND role IN ('owner', 'admin', 'moderator')
  ) OR public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public.has_staff_permission(_permission TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE user_id = auth.uid()
      AND is_active = true
      AND (
        role IN ('owner', 'admin')
        OR permissions @> ARRAY['*']
        OR permissions @> ARRAY[_permission]
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.has_finance_access()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
  ) OR public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public.is_official_seller()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE user_id = auth.uid()
      AND is_active = true
      AND role IN ('official_seller', 'owner', 'admin')
  );
$$;

-- ============ 5. FIX staff_members UNIQUE CONSTRAINT ============
-- Remove the old unique constraint on user_id if it exists to allow soft-delete pattern
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'staff_members_user_id_key' AND conrelid = 'public.staff_members'::regclass
  ) THEN
    ALTER TABLE public.staff_members DROP CONSTRAINT staff_members_user_id_key;
  END IF;
END $$;

-- Keep unique index for active users only
DROP INDEX IF EXISTS idx_staff_members_active_user;
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_members_active_user
  ON public.staff_members(user_id) WHERE is_active = true;

-- ============ 6. RECREATE ALL RLS POLICIES ============

-- Tickets
DROP POLICY IF EXISTS "tickets_select" ON public.tickets;
DROP POLICY IF EXISTS "tickets_insert" ON public.tickets;
DROP POLICY IF EXISTS "tickets_update" ON public.tickets;

CREATE POLICY "tickets_select" ON public.tickets FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.has_staff_permission('tickets.read')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "tickets_insert" ON public.tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.has_staff_permission('tickets.respond'));

CREATE POLICY "tickets_update" ON public.tickets FOR UPDATE
  USING (
    public.has_staff_permission('tickets.resolve')
    OR public.has_staff_permission('tickets.assign')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR auth.uid() = user_id
  )
  WITH CHECK (
    public.has_staff_permission('tickets.resolve')
    OR public.has_staff_permission('tickets.assign')
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR auth.uid() = user_id
  );

-- Ticket messages
DROP POLICY IF EXISTS "ticket_messages_select" ON public.ticket_messages;
DROP POLICY IF EXISTS "ticket_messages_insert" ON public.ticket_messages;

CREATE POLICY "ticket_messages_select" ON public.ticket_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
        AND (
          t.user_id = auth.uid()
          OR public.has_staff_permission('tickets.read')
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
        )
    )
  );

CREATE POLICY "ticket_messages_insert" ON public.ticket_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
        AND (
          t.user_id = auth.uid()
          OR public.has_staff_permission('tickets.respond')
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
        )
    )
  );

-- Staff members
DROP POLICY IF EXISTS "staff_members_select" ON public.staff_members;
DROP POLICY IF EXISTS "staff_members_manage" ON public.staff_members;

CREATE POLICY "staff_members_select" ON public.staff_members FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_owner()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_staff_permission('staff.manage')
  );

CREATE POLICY "staff_members_manage" ON public.staff_members FOR ALL
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- Audit logs
DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs_new;
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs_new;

CREATE POLICY "audit_logs_select" ON public.audit_logs_new FOR SELECT
  USING (public.is_staff() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "audit_logs_insert" ON public.audit_logs_new FOR INSERT
  WITH CHECK (auth.uid() = actor_id);

-- Admin notifications
DROP POLICY IF EXISTS "admin_notifications_select" ON public.admin_notifications;
DROP POLICY IF EXISTS "admin_notifications_insert" ON public.admin_notifications;

CREATE POLICY "admin_notifications_select" ON public.admin_notifications FOR SELECT
  USING (public.is_staff() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin_notifications_insert" ON public.admin_notifications FOR INSERT
  WITH CHECK (true);

-- Site announcements
DROP POLICY IF EXISTS "announcements_public_read" ON public.site_announcements;
DROP POLICY IF EXISTS "announcements_admin_write" ON public.site_announcements;

CREATE POLICY "announcements_public_read" ON public.site_announcements FOR SELECT
  USING (active = true AND (type = 'permanent' OR expires_at IS NULL OR expires_at > now()));

CREATE POLICY "announcements_admin_write" ON public.site_announcements FOR ALL
  USING (public.is_owner() OR public.has_staff_permission('announcements.create'))
  WITH CHECK (public.is_owner() OR public.has_staff_permission('announcements.create'));

-- Profiles - add admin read policy
DROP POLICY IF EXISTS "profiles_admin_read" ON public.profiles;
CREATE POLICY "profiles_admin_read" ON public.profiles FOR SELECT
  USING (true);

-- Listings
DROP POLICY IF EXISTS "lst_public" ON public.listings;
DROP POLICY IF EXISTS "lst_seller" ON public.listings;
DROP POLICY IF EXISTS "lst_admin" ON public.listings;
DROP POLICY IF EXISTS "lst_smiley_staff" ON public.listings;

CREATE POLICY "lst_public" ON public.listings FOR SELECT
  USING (
    status = 'active'
    OR auth.uid() = seller_id
    OR public.is_admin_staff()
    OR public.is_owner()
  );

CREATE POLICY "lst_seller_own" ON public.listings FOR ALL
  USING (auth.uid() = seller_id AND is_smiley_store = false)
  WITH CHECK (auth.uid() = seller_id AND is_smiley_store = false);

CREATE POLICY "lst_admin_manage" ON public.listings FOR ALL
  USING (public.is_owner() OR public.has_staff_permission('listings.approve'))
  WITH CHECK (public.is_owner() OR public.has_staff_permission('listings.approve'));

CREATE POLICY "lst_smiley_manage" ON public.listings FOR ALL
  USING (
    is_smiley_store = true
    AND (public.is_owner() OR public.is_official_seller())
  )
  WITH CHECK (
    is_smiley_store = true
    AND (public.is_owner() OR public.is_official_seller())
  );

-- ============ 7. TICKET STATUS ENUM ============
-- Wait, ticket_status exists as enum. Let's ensure it has all values.
DO $$ BEGIN
  -- ticket_status is already created as ENUM ('open','in_progress','waiting_user','resolved','closed')
  -- No changes needed
  NULL;
END $$;

-- ============ 8. RECREATE TRIGGERS ============
DROP TRIGGER IF EXISTS trg_notify_ticket_created ON public.tickets;
DROP TRIGGER IF EXISTS trg_log_ticket_created ON public.tickets;
DROP TRIGGER IF EXISTS trg_notify_ticket_message ON public.ticket_messages;

CREATE OR REPLACE FUNCTION public.notify_ticket_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.create_admin_notification(
    'new_ticket',
    'Novo Ticket #' || substr(NEW.id::text, 1, 8),
    'Assunto: ' || NEW.subject,
    jsonb_build_object('ticket_id', NEW.id, 'user_id', NEW.user_id, 'category', NEW.category)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_ticket_created
AFTER INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_created();

CREATE OR REPLACE FUNCTION public.log_ticket_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs_new (actor_id, action, entity_type, entity_id, metadata)
  VALUES (NEW.user_id, 'ticket.created', 'ticket', NEW.id::text,
    jsonb_build_object('category', NEW.category, 'subject', NEW.subject));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_ticket_created
AFTER INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.log_ticket_created();

CREATE OR REPLACE FUNCTION public.notify_ticket_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ticket_subject TEXT;
  _ticket_user_id UUID;
BEGIN
  SELECT subject, user_id INTO _ticket_subject, _ticket_user_id
  FROM public.tickets WHERE id = NEW.ticket_id;

  IF NEW.sender_id = _ticket_user_id THEN
    PERFORM public.create_admin_notification(
      'ticket_reply',
      'Nova resposta no ticket',
      'Ticket: ' || _ticket_subject,
      jsonb_build_object('ticket_id', NEW.ticket_id, 'sender_id', NEW.sender_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_ticket_message
AFTER INSERT ON public.ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_message();

-- Recreate wallet trigger
DROP TRIGGER IF EXISTS on_profile_created_create_wallet ON public.profiles;
CREATE TRIGGER on_profile_created_create_wallet
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.ensure_wallet_for_user();
