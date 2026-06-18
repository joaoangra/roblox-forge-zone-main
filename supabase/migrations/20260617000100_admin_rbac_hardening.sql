-- ============================================================
-- BuxHub - Admin RBAC hardening
-- ============================================================

DO $$ BEGIN
  ALTER TYPE public.staff_role ADD VALUE IF NOT EXISTS 'admin';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.staff_role ADD VALUE IF NOT EXISTS 'staff';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.staff_role ADD VALUE IF NOT EXISTS 'helper';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS staff_members_single_active_owner
  ON public.staff_members ((role))
  WHERE role::text = 'owner' AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_staff_members_user_active
  ON public.staff_members(user_id, is_active);

CREATE OR REPLACE FUNCTION public.is_admin_staff()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_members
    WHERE user_id = auth.uid()
      AND is_active = true
      AND role::text IN ('owner', 'admin', 'moderator')
  ) OR public.has_role(auth.uid(), 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_members
    WHERE user_id = auth.uid() AND is_active = true
  ) OR public.has_role(auth.uid(), 'admin');
$$;

CREATE OR REPLACE FUNCTION public.has_staff_permission(_permission TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_members
    WHERE user_id = auth.uid()
      AND is_active = true
      AND (
        role::text = 'owner'
        OR permissions @> ARRAY['*']
        OR permissions @> ARRAY[_permission]
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.has_finance_access()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_members
    WHERE user_id = auth.uid() AND role::text = 'owner' AND is_active = true
  );
$$;

DROP POLICY IF EXISTS "tk_own" ON public.tickets;
CREATE POLICY "tk_own" ON public.tickets FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.has_staff_permission('tickets.read')
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "tk_admin_upd" ON public.tickets;
CREATE POLICY "tk_admin_upd" ON public.tickets FOR UPDATE
  USING (
    public.has_staff_permission('tickets.resolve')
    OR public.has_staff_permission('tickets.assign')
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    public.has_staff_permission('tickets.resolve')
    OR public.has_staff_permission('tickets.assign')
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "tm_read" ON public.ticket_messages;
CREATE POLICY "tm_read" ON public.ticket_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.tickets t
      WHERE t.id = ticket_id
        AND (
          t.user_id = auth.uid()
          OR public.has_staff_permission('tickets.read')
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "tm_send" ON public.ticket_messages;
CREATE POLICY "tm_send" ON public.ticket_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1
      FROM public.tickets t
      WHERE t.id = ticket_id
        AND (
          t.user_id = auth.uid()
          OR public.has_staff_permission('tickets.respond')
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "audit_admin_read" ON public.audit_logs_new;
CREATE POLICY "audit_admin_read" ON public.audit_logs_new FOR SELECT
  USING (public.has_staff_permission('logs.read') OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "notif_staff_read" ON public.admin_notifications;
CREATE POLICY "notif_staff_read" ON public.admin_notifications FOR SELECT
  USING (public.is_staff());

DROP POLICY IF EXISTS "staff_self_or_admin_read" ON public.staff_members;
CREATE POLICY "staff_self_or_owner_read" ON public.staff_members FOR SELECT
  USING (auth.uid() = user_id OR public.is_owner());

DROP POLICY IF EXISTS "announcements_admin_write" ON public.site_announcements;
CREATE POLICY "announcements_admin_write" ON public.site_announcements FOR ALL
  USING (
    public.is_owner()
    OR public.has_staff_permission('announcements.create')
    OR public.has_staff_permission('announcements.edit')
    OR public.has_staff_permission('announcements.delete')
  )
  WITH CHECK (
    public.is_owner()
    OR public.has_staff_permission('announcements.create')
    OR public.has_staff_permission('announcements.edit')
    OR public.has_staff_permission('announcements.delete')
  );
