-- ============================================================
-- BuxHub - Correção do Enum staff_role - Direct pg_enum approach
-- ============================================================

-- ============ 1. ADICIONAR VALORES FALTANTES AO ENUM VIA pg_enum ============
-- This is the only safe way to add values to an enum without dropping it

DO $$
DECLARE
  _enum_id OID;
  _existing TEXT[];
BEGIN
  -- Get the OID of the staff_role enum type
  SELECT t.oid INTO _enum_id
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE t.typname = 'staff_role' AND n.nspname = 'public';
  
  IF _enum_id IS NULL THEN
    RAISE NOTICE 'staff_role type does not exist, creating it';
    CREATE TYPE public.staff_role AS ENUM ('owner', 'admin', 'moderator', 'staff', 'support', 'helper', 'seller');
    RETURN;
  END IF;

  -- Get existing values
  SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder) INTO _existing
  FROM pg_enum e
  WHERE e.enumtypid = _enum_id;

  RAISE NOTICE 'Existing enum values: %', _existing;

  -- Add missing values
  IF NOT (_existing @> ARRAY['admin']) THEN
    ALTER TYPE public.staff_role ADD VALUE 'admin' BEFORE 'moderator';
    RAISE NOTICE 'Added admin';
  END IF;
  
  IF NOT (_existing @> ARRAY['staff']) THEN
    ALTER TYPE public.staff_role ADD VALUE 'staff' AFTER 'moderator';
    RAISE NOTICE 'Added staff';
  END IF;
  
  IF NOT (_existing @> ARRAY['helper']) THEN
    ALTER TYPE public.staff_role ADD VALUE 'helper' AFTER 'support';
    RAISE NOTICE 'Added helper';
  END IF;
END $$;

-- ============ 2. GARANTIR QUE A COLUNA ESTÁ USANDO O ENUM ============
DO $$
DECLARE
  _col_type TEXT;
BEGIN
  SELECT t.typname INTO _col_type
  FROM pg_attribute a
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE a.attrelid = 'public.staff_members'::regclass
    AND a.attname = 'role'
    AND NOT a.attisdropped;

  IF _col_type = 'text' THEN
    -- Column was converted to text by previous failed migration, convert back
    ALTER TABLE public.staff_members ALTER COLUMN role TYPE public.staff_role USING role::public.staff_role;
    ALTER TABLE public.staff_members ALTER COLUMN role SET DEFAULT 'helper';
    RAISE NOTICE 'Converted role column back to staff_role enum';
  END IF;
END $$;

-- ============ 3. RECRIAR FUNÇÕES ============

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role::text
  );
$$;

CREATE OR REPLACE FUNCTION public.has_staff_permission(_permission TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE user_id = auth.uid()
      AND is_active = true
      AND (role IN ('owner', 'admin') OR permissions @> ARRAY[_permission])
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

CREATE OR REPLACE FUNCTION public.has_finance_access()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
  ) OR public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

-- ============ 4. RECRIAR POLÍTICAS RLS ============

-- Drop existing policies first (ignore if not exist)
DROP POLICY IF EXISTS "tickets_select" ON public.tickets;
DROP POLICY IF EXISTS "tickets_insert" ON public.tickets;
DROP POLICY IF EXISTS "tickets_update" ON public.tickets;
DROP POLICY IF EXISTS "ticket_messages_select" ON public.ticket_messages;
DROP POLICY IF EXISTS "ticket_messages_insert" ON public.ticket_messages;
DROP POLICY IF EXISTS "staff_members_select" ON public.staff_members;
DROP POLICY IF EXISTS "staff_members_manage" ON public.staff_members;
DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs_new;
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs_new;
DROP POLICY IF EXISTS "admin_notifications_select" ON public.admin_notifications;
DROP POLICY IF EXISTS "admin_notifications_insert" ON public.admin_notifications;
DROP POLICY IF EXISTS "announcements_public_read" ON public.site_announcements;
DROP POLICY IF EXISTS "announcements_admin_write" ON public.site_announcements;

-- Tickets
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
CREATE POLICY "staff_members_select" ON public.staff_members FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_owner()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_staff_permission('staff.manage')
  );

CREATE POLICY "staff_members_manage" ON public.staff_members FOR ALL
  USING (
    public.is_owner()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    public.is_owner()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Audit logs
CREATE POLICY "audit_logs_select" ON public.audit_logs_new FOR SELECT
  USING (public.is_staff() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "audit_logs_insert" ON public.audit_logs_new FOR INSERT
  WITH CHECK (auth.uid() = actor_id);

-- Admin notifications
CREATE POLICY "admin_notifications_select" ON public.admin_notifications FOR SELECT
  USING (public.is_staff() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admin_notifications_insert" ON public.admin_notifications FOR INSERT
  WITH CHECK (true);

-- Site announcements
CREATE POLICY "announcements_public_read" ON public.site_announcements FOR SELECT
  USING (active = true AND (type = 'permanent' OR expires_at IS NULL OR expires_at > now()));

CREATE POLICY "announcements_admin_write" ON public.site_announcements FOR ALL
  USING (public.is_owner() OR public.has_staff_permission('announcements.create'))
  WITH CHECK (public.is_owner() OR public.has_staff_permission('announcements.create'));

-- ============ 5. RECRIAR TRIGGERS ============

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