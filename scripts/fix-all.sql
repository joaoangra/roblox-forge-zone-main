-- ============================================================
-- CORREÇÃO COMPLETA - BuxHub
-- Copie e cole este script inteiro no SQL Editor do Supabase
-- ============================================================

-- ============================================================
-- 1. CORRIGIR ENUM staff_role (adicionar 'admin' e 'helper' que faltam)
-- ============================================================
DO $$ BEGIN
  ALTER TYPE public.staff_role ADD VALUE IF NOT EXISTS 'admin';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.staff_role ADD VALUE IF NOT EXISTS 'helper';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. CRIAR FUNÇÃO has_role (usada por várias políticas RLS)
--    NOTA: user_roles.role é do tipo app_role (enum), por isso usamos ::text
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_role(uid UUID, role_name TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = uid AND role::text = role_name
  );
$$;

-- ============================================================
-- 3. CORRIGIR RLS DA TABELA tickets
-- ============================================================
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tickets_user_insert" ON public.tickets;
DROP POLICY IF EXISTS "tickets_user_select" ON public.tickets;
DROP POLICY IF EXISTS "tickets_staff_select" ON public.tickets;
DROP POLICY IF EXISTS "tickets_staff_update" ON public.tickets;

-- Usuários podem criar seus próprios tickets
CREATE POLICY "tickets_user_insert" ON public.tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Usuários podem ver seus próprios tickets
CREATE POLICY "tickets_user_select" ON public.tickets
  FOR SELECT USING (auth.uid() = user_id);

-- Staff/Admins podem ver TODOS os tickets
CREATE POLICY "tickets_staff_select" ON public.tickets
  FOR SELECT USING (public.is_staff() OR public.has_role(auth.uid(), 'admin'));

-- Staff podem atualizar tickets (mudar status, atribuir)
CREATE POLICY "tickets_staff_update" ON public.tickets
  FOR UPDATE USING (public.is_staff() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_staff() OR public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;

-- ============================================================
-- 4. CORRIGIR RLS DA TABELA ticket_messages
-- ============================================================
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tmsg_user_insert" ON public.ticket_messages;
DROP POLICY IF EXISTS "tmsg_user_select" ON public.ticket_messages;
DROP POLICY IF EXISTS "tmsg_staff_select" ON public.ticket_messages;

-- Usuários podem inserir mensagens nos próprios tickets
CREATE POLICY "tmsg_user_insert" ON public.ticket_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND EXISTS (
      SELECT 1 FROM public.tickets WHERE id = ticket_id AND user_id = auth.uid()
    )
  );

-- Usuários podem ler mensagens dos próprios tickets
CREATE POLICY "tmsg_user_select" ON public.ticket_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tickets WHERE id = ticket_id AND user_id = auth.uid()
    )
  );

-- Staff podem ler todas as mensagens
CREATE POLICY "tmsg_staff_select" ON public.ticket_messages
  FOR SELECT USING (public.is_staff() OR public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT ON public.ticket_messages TO authenticated;
GRANT ALL ON public.ticket_messages TO service_role;

-- ============================================================
-- 5. CORRIGIR RLS DA TABELA profiles (leitura pública básica)
-- ============================================================
DROP POLICY IF EXISTS "profiles_user_read" ON public.profiles;
CREATE POLICY "profiles_user_read" ON public.profiles
  FOR SELECT USING (true);

-- ============================================================
-- 6. CORRIGIR RLS DA TABELA admin_notifications
-- ============================================================
DROP POLICY IF EXISTS "notif_staff_read" ON public.admin_notifications;
CREATE POLICY "notif_staff_read" ON public.admin_notifications
  FOR SELECT USING (public.is_staff() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "notif_insert" ON public.admin_notifications;
CREATE POLICY "notif_insert" ON public.admin_notifications
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- 7. CRIAR TRIGGER: Notificar admin quando ticket for criado
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_admin_new_ticket()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.admin_notifications (type, title, body, data)
  VALUES (
    'new_ticket',
    'Novo ticket de suporte',
    format('Ticket #%s: %s (categoria: %s)', substr(NEW.id::text, 1, 8), NEW.subject, NEW.category::text),
    jsonb_build_object('ticket_id', NEW.id, 'user_id', NEW.user_id, 'category', NEW.category, 'link', '/admin?tab=tickets')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_new_ticket ON public.tickets;
CREATE TRIGGER trg_notify_admin_new_ticket
AFTER INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_new_ticket();

-- ============================================================
-- 8. CRIAR TRIGGER: Notificar admin quando usuário responder ticket
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_admin_ticket_reply()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ticket_subject text;
  _ticket_user_id uuid;
BEGIN
  SELECT subject, user_id INTO _ticket_subject, _ticket_user_id FROM public.tickets WHERE id = NEW.ticket_id;

  -- Só notificar se a resposta for do dono do ticket (não do staff)
  IF NEW.sender_id = _ticket_user_id THEN
    INSERT INTO public.admin_notifications (type, title, body, data)
    VALUES (
      'ticket_reply',
      'Nova resposta em ticket',
      format('Resposta em "%s": %s', _ticket_subject, LEFT(NEW.body, 100)),
      jsonb_build_object('ticket_id', NEW.ticket_id, 'link', '/admin?tab=tickets')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_ticket_reply ON public.ticket_messages;
CREATE TRIGGER trg_notify_admin_ticket_reply
AFTER INSERT ON public.ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_ticket_reply();

-- ============================================================
-- 9. GARANTIR QUE staff_members TEM RLS CORRETO
-- ============================================================
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_self_or_admin_read" ON public.staff_members;
CREATE POLICY "staff_self_or_admin_read" ON public.staff_members FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.staff_members s
    WHERE s.user_id = auth.uid() AND s.role::text = 'owner' AND s.is_active = true
  ));

DROP POLICY IF EXISTS "staff_owner_manage" ON public.staff_members;
CREATE POLICY "staff_owner_manage" ON public.staff_members FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.staff_members s
    WHERE s.user_id = auth.uid() AND s.role::text = 'owner' AND s.is_active = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.staff_members s
    WHERE s.user_id = auth.uid() AND s.role::text = 'owner' AND s.is_active = true
  ));

GRANT SELECT ON public.staff_members TO authenticated;
GRANT ALL ON public.staff_members TO service_role;

-- ============================================================
-- 10. GARANTIR QUE audit_logs_new TEM RLS CORRETO
-- ============================================================
ALTER TABLE public.audit_logs_new ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_admin_read" ON public.audit_logs_new;
CREATE POLICY "audit_admin_read" ON public.audit_logs_new FOR SELECT
  USING (public.is_staff() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "audit_insert" ON public.audit_logs_new;
CREATE POLICY "audit_insert" ON public.audit_logs_new FOR INSERT
  WITH CHECK (auth.uid() = actor_id);

GRANT SELECT ON public.audit_logs_new TO authenticated;
GRANT INSERT ON public.audit_logs_new TO authenticated;
GRANT ALL ON public.audit_logs_new TO service_role;

-- ============================================================
-- 11. GARANTIR QUE site_announcements TEM RLS CORRETO
-- ============================================================
ALTER TABLE public.site_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "announcements_public_read" ON public.site_announcements;
CREATE POLICY "announcements_public_read" ON public.site_announcements FOR SELECT
  USING (active = true AND (type = 'permanent' OR expires_at IS NULL OR expires_at > now()));

DROP POLICY IF EXISTS "announcements_admin_write" ON public.site_announcements;
CREATE POLICY "announcements_admin_write" ON public.site_announcements FOR ALL
  USING (public.is_owner() OR public.has_staff_permission('announcements.create'))
  WITH CHECK (public.is_owner() OR public.has_staff_permission('announcements.create'));

GRANT SELECT ON public.site_announcements TO anon, authenticated;
GRANT ALL ON public.site_announcements TO service_role;

-- ============================================================
-- PRONTO! Tudo corrigido.
-- Após executar, teste:
-- 1. Faça login como usuário comum e abra um ticket
-- 2. Verifique se o ticket aparece no painel admin
-- 3. Verifique se as notificações estão funcionando
-- ============================================================