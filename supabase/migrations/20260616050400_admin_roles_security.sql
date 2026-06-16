-- ============================================================
-- BuxHub - Sistema de Roles, Permissões, Logs e Avisos
-- ============================================================

-- ============ 1. ENUM DE ROLES EXTENDIDO ============
DO $$ BEGIN
  CREATE TYPE public.staff_role AS ENUM ('owner', 'moderator', 'support', 'seller');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============ 2. TABELA DE STAFF (permissões granulares) ============
CREATE TABLE IF NOT EXISTS public.staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.staff_role NOT NULL DEFAULT 'support',
  permissions TEXT[] NOT NULL DEFAULT '{}',
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Permissões disponíveis:
-- tickets.read, tickets.respond, tickets.resolve
-- users.read, users.warn, users.suspend, users.ban
-- shop.products.manage (próprios)
-- shop.products.read_all
-- logs.read
-- announcements.create, announcements.edit, announcements.delete
-- disputes.resolve
-- finance.read (SOMENTE owner)
-- finance.withdraw (SOMENTE owner)
-- settings.read (SOMENTE owner)
-- settings.write (SOMENTE owner)
-- staff.manage (SOMENTE owner)

GRANT SELECT ON public.staff_members TO authenticated;
GRANT ALL ON public.staff_members TO service_role;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança para staff_members
CREATE POLICY "staff_self_or_admin_read" ON public.staff_members FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.staff_members s
    WHERE s.user_id = auth.uid() AND s.role = 'owner' AND s.is_active = true
  ));

CREATE POLICY "staff_owner_manage" ON public.staff_members FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.staff_members s
    WHERE s.user_id = auth.uid() AND s.role = 'owner' AND s.is_active = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.staff_members s
    WHERE s.user_id = auth.uid() AND s.role = 'owner' AND s.is_active = true
  ));

-- ============ 3. FUNÇÃO PARA VERIFICAR PERMISSÕES ============
CREATE OR REPLACE FUNCTION public.has_staff_permission(_permission TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE user_id = auth.uid()
      AND is_active = true
      AND (role = 'owner' OR permissions @> ARRAY[_permission])
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
  );
$$;

-- ============ 4. LOGS DE AUDITORIA OTIMIZADOS ============
CREATE TABLE IF NOT EXISTS public.audit_logs_new (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance em consultas de log
CREATE INDEX IF NOT EXISTS idx_audit_logs_new_created ON public.audit_logs_new(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_new_actor ON public.audit_logs_new(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_new_action ON public.audit_logs_new(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_new_entity ON public.audit_logs_new(entity_type, entity_id);

-- Para evitar sobrecarga, logs antigos (>90 dias) podem ser arquivados automaticamente
-- Trigger para particionamento temporal (opcional - pode ser feito manualmente)

GRANT SELECT ON public.audit_logs_new TO authenticated;
GRANT INSERT ON public.audit_logs_new TO authenticated;
GRANT ALL ON public.audit_logs_new TO service_role;
ALTER TABLE public.audit_logs_new ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_admin_read" ON public.audit_logs_new FOR SELECT
  USING (public.is_staff() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "audit_insert" ON public.audit_logs_new FOR INSERT
  WITH CHECK (auth.uid() = actor_id);

-- ============ 5. FUNÇÃO PARA LOGS (server-side apenas) ============
CREATE OR REPLACE FUNCTION public.log_action(
  _actor_id UUID,
  _action TEXT,
  _entity_type TEXT,
  _entity_id TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT '{}',
  _ip_address INET DEFAULT NULL
)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _log_id BIGINT;
BEGIN
  INSERT INTO public.audit_logs_new (actor_id, action, entity_type, entity_id, metadata, ip_address)
  VALUES (_actor_id, _action, _entity_type, _entity_id, _metadata, _ip_address)
  RETURNING id INTO _log_id;
  RETURN _log_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_action FROM PUBLIC, anon, authenticated;

-- ============ 6. AVISOS GLOBAIS ============
CREATE TABLE IF NOT EXISTS public.site_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'critical')),
  type TEXT NOT NULL DEFAULT 'permanent' CHECK (type IN ('permanent', 'temporary')),
  expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_announcements_active ON public.site_announcements(active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_announcements_priority ON public.site_announcements(priority);

GRANT SELECT ON public.site_announcements TO anon, authenticated;
GRANT ALL ON public.site_announcements TO service_role;
ALTER TABLE public.site_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements_public_read" ON public.site_announcements FOR SELECT
  USING (active = true AND (type = 'permanent' OR expires_at IS NULL OR expires_at > now()));

CREATE POLICY "announcements_admin_write" ON public.site_announcements FOR ALL
  USING (public.is_owner() OR public.has_staff_permission('announcements.create'))
  WITH CHECK (public.is_owner() OR public.has_staff_permission('announcements.create'));

-- ============ 7. NOTIFICAÇÕES DO SISTEMA ============
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tipos de notificação: new_ticket, ticket_reply, new_dispute, new_user, new_order, report

CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread ON public.admin_notifications(read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON public.admin_notifications(type);

GRANT SELECT, INSERT ON public.admin_notifications TO authenticated;
GRANT ALL ON public.admin_notifications TO service_role;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_staff_read" ON public.admin_notifications FOR SELECT
  USING (public.is_staff() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "notif_insert" ON public.admin_notifications FOR INSERT
  WITH CHECK (true); -- Apenas service_role ou triggers internos devem inserir

-- ============ 8. FUNÇÃO PARA CRIAR NOTIFICAÇÃO ============
CREATE OR REPLACE FUNCTION public.create_admin_notification(
  _type TEXT,
  _title TEXT,
  _body TEXT DEFAULT NULL,
  _data JSONB DEFAULT '{}'
)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _notif_id BIGINT;
BEGIN
  INSERT INTO public.admin_notifications (type, title, body, data)
  VALUES (_type, _title, _body, _data)
  RETURNING id INTO _notif_id;
  RETURN _notif_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_admin_notification FROM PUBLIC, anon, authenticated;

-- ============ 9. TRIGGER: NOTIFICAR QUANDO TICKET FOR CRIADO ============
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

DROP TRIGGER IF EXISTS trg_notify_ticket_created ON public.tickets;
CREATE TRIGGER trg_notify_ticket_created
AFTER INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_created();

-- ============ 10. TRIGGER: LOGAR CRIAÇÃO DE TICKET ============
CREATE OR REPLACE FUNCTION public.log_ticket_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs_new (actor_id, action, entity_type, entity_id, metadata)
  VALUES (NEW.user_id, 'ticket.created', 'ticket', NEW.id::text,
    jsonb_build_object('category', NEW.category, 'subject', NEW.subject));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_ticket_created ON public.tickets;
CREATE TRIGGER trg_log_ticket_created
AFTER INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.log_ticket_created();

-- ============ 11. FUNÇÃO PARA VERIFICAR SE USUÁRIO TEM ACESSO FINANCEIRO ============
CREATE OR REPLACE FUNCTION public.has_finance_access()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE user_id = auth.uid() AND role = 'owner' AND is_active = true
  ) OR public.has_role(auth.uid(), 'admin');
$$;

-- ============ 12. VIEW: TICKETS ABERTOS PARA STAFF ============
CREATE OR REPLACE VIEW public.staff_open_tickets AS
SELECT
  t.id,
  t.user_id,
  p.username AS user_username,
  p.display_name AS user_display_name,
  t.category::text AS category,
  t.subject,
  t.status::text AS status,
  t.created_at,
  t.updated_at,
  (SELECT COUNT(*) FROM public.ticket_messages tm WHERE tm.ticket_id = t.id) AS message_count,
  (SELECT MAX(tm2.created_at) FROM public.ticket_messages tm2 WHERE tm2.ticket_id = t.id) AS last_message_at
FROM public.tickets t
LEFT JOIN public.profiles p ON p.id = t.user_id
WHERE t.status IN ('open', 'in_progress', 'waiting_user')
ORDER BY t.created_at DESC;

GRANT SELECT ON public.staff_open_tickets TO authenticated;
GRANT ALL ON public.staff_open_tickets TO service_role;

-- ============ 13. ATUALIZAR app_role ENUM COM SELLER ============
-- Nota: Já existe app_role com 'admin' e 'user'. Adicionar seller via ALTER TYPE
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'seller';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;