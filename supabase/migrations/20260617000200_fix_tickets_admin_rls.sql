-- ============================================================
-- BuxHub - Correção de RLS para Tickets/Admin e Índices
-- ============================================================

-- ============ 1. CORRIGIR RLS DA TABELA tickets ============
DROP POLICY IF EXISTS "tk_own" ON public.tickets;
DROP POLICY IF EXISTS "tk_open" ON public.tickets;
DROP POLICY IF EXISTS "tk_admin_upd" ON public.tickets;
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

-- ============ 2. CORRIGIR RLS DA TABELA ticket_messages ============
DROP POLICY IF EXISTS "tm_read" ON public.ticket_messages;
DROP POLICY IF EXISTS "tm_send" ON public.ticket_messages;
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

-- ============ 3. CORRIGIR RLS DA TABELA staff_members ============
DROP POLICY IF EXISTS "staff_self_or_owner_read" ON public.staff_members;
DROP POLICY IF EXISTS "staff_self_or_admin_read" ON public.staff_members;
DROP POLICY IF EXISTS "staff_members_select" ON public.staff_members;

CREATE POLICY "staff_members_select" ON public.staff_members FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_owner()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_staff_permission('staff.manage')
  );

DROP POLICY IF EXISTS "staff_owner_manage" ON public.staff_members;
DROP POLICY IF EXISTS "staff_members_manage" ON public.staff_members;

CREATE POLICY "staff_members_manage" ON public.staff_members FOR ALL
  USING (
    public.is_owner()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    public.is_owner()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- ============ 4. CORRIGIR RLS DO audit_logs_new ============
DROP POLICY IF EXISTS "audit_admin_read" ON public.audit_logs_new;
DROP POLICY IF EXISTS "audit_insert" ON public.audit_logs_new;
DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs_new;
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs_new;

CREATE POLICY "audit_logs_select" ON public.audit_logs_new FOR SELECT
  USING (public.is_staff() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "audit_logs_insert" ON public.audit_logs_new FOR INSERT
  WITH CHECK (auth.uid() = actor_id);

-- ============ 5. CORRIGIR RLS DO admin_notifications ============
DROP POLICY IF EXISTS "notif_staff_read" ON public.admin_notifications;
DROP POLICY IF EXISTS "notif_insert" ON public.admin_notifications;
DROP POLICY IF EXISTS "admin_notifications_select" ON public.admin_notifications;
DROP POLICY IF EXISTS "admin_notifications_insert" ON public.admin_notifications;

CREATE POLICY "admin_notifications_select" ON public.admin_notifications FOR SELECT
  USING (public.is_staff());

CREATE POLICY "admin_notifications_insert" ON public.admin_notifications FOR INSERT
  WITH CHECK (true);

-- ============ 6. CRIAR ÍNDICES PARA PERFORMANCE ============
CREATE INDEX IF NOT EXISTS idx_tickets_user_status ON public.tickets(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_created ON public.tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_created ON public.ticket_messages(ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON public.profiles(display_name);
CREATE INDEX IF NOT EXISTS idx_profiles_premium ON public.profiles(is_premium, premium_until);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_status ON public.marketplace_orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_premium_orders_status ON public.premium_orders(status, created_at DESC);

-- ============ 7. ATUALIZAR FUNÇÃO is_staff PARA INCLUIR LEGACY ADMIN ============
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE user_id = auth.uid() AND is_active = true
  ) OR public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

-- ============ 8. ATUALIZAR FUNÇÃO is_admin_staff ============
CREATE OR REPLACE FUNCTION public.is_admin_staff()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_members
    WHERE user_id = auth.uid()
      AND is_active = true
      AND role::text IN ('owner', 'admin', 'moderator')
  ) OR public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

-- ============ 9. CORRIGIR FUNÇÃO has_finance_access ============
CREATE OR REPLACE FUNCTION public.has_finance_access()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_members
    WHERE user_id = auth.uid() AND role::text = 'owner' AND is_active = true
  ) OR public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

-- ============ 10. FUNÇÃO PARA MARCAR NOTIFICAÇÕES COMO LIDAS ============
CREATE OR REPLACE FUNCTION public.mark_notifications_read(_type TEXT DEFAULT NULL)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _count INT;
BEGIN
  IF _type IS NULL THEN
    UPDATE public.admin_notifications SET read = true WHERE read = false;
    GET DIAGNOSTICS _count = ROW_COUNT;
  ELSE
    UPDATE public.admin_notifications SET read = true WHERE read = false AND type = _type;
    GET DIAGNOSTICS _count = ROW_COUNT;
  END IF;
  RETURN _count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_notifications_read FROM PUBLIC, anon;

-- ============ 11. TRIGGER PARA NOTIFICAR NOVA MENSAGEM EM TICKET ============
CREATE OR REPLACE FUNCTION public.notify_ticket_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ticket_subject TEXT;
  _ticket_user_id UUID;
BEGIN
  SELECT subject, user_id INTO _ticket_subject, _ticket_user_id
  FROM public.tickets WHERE id = NEW.ticket_id;

  IF NEW.sender_id != _ticket_user_id THEN
    NULL;
  ELSE
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

DROP TRIGGER IF EXISTS trg_notify_ticket_message ON public.ticket_messages;
CREATE TRIGGER trg_notify_ticket_message
AFTER INSERT ON public.ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_message();