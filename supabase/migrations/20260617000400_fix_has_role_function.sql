-- ============================================================
-- BuxHub - Fix has_role function (user_roles.role is TEXT, not app_role)
-- ============================================================

-- Drop all policies that depend on has_role first
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

-- Drop the old function with CASCADE
DROP FUNCTION IF EXISTS public.has_role(UUID, public.app_role) CASCADE;
DROP FUNCTION IF EXISTS public.has_role(UUID, TEXT) CASCADE;

-- Recreate with TEXT parameter (user_roles.role is TEXT)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Also fix is_staff to use TEXT comparison
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE user_id = auth.uid() AND is_active = true
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_staff()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE user_id = auth.uid()
      AND is_active = true
      AND role IN ('owner', 'admin', 'moderator')
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_finance_access()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- Recreate RLS policies using the fixed has_role
CREATE POLICY "tickets_select" ON public.tickets FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.has_staff_permission('tickets.read')
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "tickets_insert" ON public.tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.has_staff_permission('tickets.respond'));

CREATE POLICY "tickets_update" ON public.tickets FOR UPDATE
  USING (
    public.has_staff_permission('tickets.resolve')
    OR public.has_staff_permission('tickets.assign')
    OR public.has_role(auth.uid(), 'admin')
    OR auth.uid() = user_id
  )
  WITH CHECK (
    public.has_staff_permission('tickets.resolve')
    OR public.has_staff_permission('tickets.assign')
    OR public.has_role(auth.uid(), 'admin')
    OR auth.uid() = user_id
  );

CREATE POLICY "ticket_messages_select" ON public.ticket_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
        AND (
          t.user_id = auth.uid()
          OR public.has_staff_permission('tickets.read')
          OR public.has_role(auth.uid(), 'admin')
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
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );

CREATE POLICY "staff_members_select" ON public.staff_members FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_owner()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_staff_permission('staff.manage')
  );

CREATE POLICY "staff_members_manage" ON public.staff_members FOR ALL
  USING (
    public.is_owner()
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    public.is_owner()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "audit_logs_select" ON public.audit_logs_new FOR SELECT
  USING (public.is_staff() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "audit_logs_insert" ON public.audit_logs_new FOR INSERT
  WITH CHECK (auth.uid() = actor_id);

CREATE POLICY "admin_notifications_select" ON public.admin_notifications FOR SELECT
  USING (public.is_staff() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_notifications_insert" ON public.admin_notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "announcements_public_read" ON public.site_announcements FOR SELECT
  USING (active = true AND (type = 'permanent' OR expires_at IS NULL OR expires_at > now()));

CREATE POLICY "announcements_admin_write" ON public.site_announcements FOR ALL
  USING (public.is_owner() OR public.has_staff_permission('announcements.create'))
  WITH CHECK (public.is_owner() OR public.has_staff_permission('announcements.create'));