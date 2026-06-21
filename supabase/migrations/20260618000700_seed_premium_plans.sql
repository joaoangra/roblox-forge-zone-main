-- ============================================================
-- BuxHub - Seed premium plans if missing
-- ============================================================

INSERT INTO public.premium_plans (name, description, duration_days, price_brl, is_featured, sort_order, features)
SELECT 'Premium 30 dias', 'Acesso a todos os scripts premium por 1 mês', 30, 9.90, true, 1,
  ARRAY['Acesso a TODOS os scripts premium','Sem encurtadores de link','Suporte prioritário','Atualizações em primeira mão']
WHERE NOT EXISTS (SELECT 1 FROM public.premium_plans WHERE duration_days = 30);

INSERT INTO public.premium_plans (name, description, duration_days, price_brl, is_featured, sort_order, features)
SELECT 'Premium 60 dias', 'Melhor custo-benefício — 2 meses de acesso premium', 60, 16.00, false, 2,
  ARRAY['Tudo do plano mensal','Economia de R$ 3,80','Selo Premium no perfil']
WHERE NOT EXISTS (SELECT 1 FROM public.premium_plans WHERE duration_days = 60);
