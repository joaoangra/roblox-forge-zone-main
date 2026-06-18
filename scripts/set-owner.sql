-- ============================================================
-- ADICIONAR USUÁRIO COMO OWNER NO SISTEMA
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Substitua SEU-UUID-AQUI pelo seu UUID de usuário
-- (Encontre em Supabase > Authentication > Users)
INSERT INTO public.staff_members (user_id, role, permissions, is_active)
VALUES (
  '06c88cf0-978a-4568-a268-9902386ed121',
  'owner',
  ARRAY['*'],
  true
)
ON CONFLICT (user_id) 
DO UPDATE SET role = 'owner', permissions = ARRAY['*'], is_active = true, revoked_at = NULL;