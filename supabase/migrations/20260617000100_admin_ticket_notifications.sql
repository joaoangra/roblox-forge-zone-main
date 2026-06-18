-- Auto-notify admins when a new ticket is created
-- Uses the existing admin_notifications table columns: type, title, body, data

CREATE OR REPLACE FUNCTION public.notify_admin_new_ticket()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.admin_notifications (type, title, body, data)
  VALUES (
    'new_ticket',
    'Novo ticket de suporte',
    format('Ticket #%s: %s (categoria: %s)', substr(NEW.id::text, 1, 8), NEW.subject, NEW.category),
    jsonb_build_object('ticket_id', NEW.id, 'user_id', NEW.user_id, 'category', NEW.category, 'link', '/admin?tab=tickets')
  );
  RETURN NEW;
END;
$$;

-- Drop trigger if exists (idempotent)
DROP TRIGGER IF EXISTS trg_notify_admin_new_ticket ON public.tickets;

CREATE TRIGGER trg_notify_admin_new_ticket
AFTER INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_new_ticket();

-- Also notify when user replies to existing ticket
CREATE OR REPLACE FUNCTION public.notify_admin_ticket_reply()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ticket_subject text;
  _ticket_user_id uuid;
BEGIN
  SELECT subject, user_id INTO _ticket_subject, _ticket_user_id FROM public.tickets WHERE id = NEW.ticket_id;
  
  -- Only notify if the reply is from the ticket owner (not staff)
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