
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.order_status AS ENUM ('pending', 'awaiting_proof', 'confirmed', 'rejected');

-- ============ UTIL ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  premium_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "user_roles_self_read" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_public_read" ON public.categories FOR SELECT USING (true);
CREATE POLICY "categories_admin_write" ON public.categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ SCRIPTS ============
CREATE TABLE public.scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  code TEXT NOT NULL,
  game_name TEXT,
  game_image_url TEXT,
  thumbnail_url TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  views INT NOT NULL DEFAULT 0,
  copies INT NOT NULL DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX scripts_category_idx ON public.scripts(category_id);
CREATE INDEX scripts_created_idx ON public.scripts(created_at DESC);
GRANT SELECT ON public.scripts TO anon, authenticated;
GRANT ALL ON public.scripts TO service_role;
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scripts_public_read" ON public.scripts FOR SELECT USING (true);
CREATE POLICY "scripts_admin_write" ON public.scripts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER scripts_updated BEFORE UPDATE ON public.scripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ EXECUTORS ============
CREATE TABLE public.executors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  long_description TEXT,
  download_url TEXT NOT NULL,
  image_url TEXT,
  price_brl NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_free BOOLEAN NOT NULL DEFAULT true,
  supported_games TEXT[] DEFAULT '{}',
  platform TEXT[] DEFAULT '{Windows}',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  downloads INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.executors TO anon, authenticated;
GRANT ALL ON public.executors TO service_role;
ALTER TABLE public.executors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "executors_public_read" ON public.executors FOR SELECT USING (true);
CREATE POLICY "executors_admin_write" ON public.executors FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER executors_updated BEFORE UPDATE ON public.executors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PREMIUM PLANS ============
CREATE TABLE public.premium_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  duration_days INT NOT NULL,
  price_brl NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  features TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.premium_plans TO anon, authenticated;
GRANT ALL ON public.premium_plans TO service_role;
ALTER TABLE public.premium_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_public_read" ON public.premium_plans FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "plans_admin_write" ON public.premium_plans FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ PREMIUM ORDERS ============
CREATE TABLE public.premium_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.premium_plans(id),
  amount_brl NUMERIC(10,2) NOT NULL,
  status public.order_status NOT NULL DEFAULT 'pending',
  pix_proof_url TEXT,
  user_notes TEXT,
  admin_notes TEXT,
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX orders_user_idx ON public.premium_orders(user_id);
CREATE INDEX orders_status_idx ON public.premium_orders(status);
GRANT SELECT, INSERT, UPDATE ON public.premium_orders TO authenticated;
GRANT ALL ON public.premium_orders TO service_role;
ALTER TABLE public.premium_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_self_read" ON public.premium_orders FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "orders_self_insert" ON public.premium_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "orders_self_update" ON public.premium_orders FOR UPDATE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER orders_updated BEFORE UPDATE ON public.premium_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ORDER MESSAGES (chat) ============
CREATE TABLE public.order_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.premium_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  attachment_url TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX order_messages_order_idx ON public.order_messages(order_id, created_at);
GRANT SELECT, INSERT ON public.order_messages TO authenticated;
GRANT ALL ON public.order_messages TO service_role;
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_messages_read" ON public.order_messages FOR SELECT
  USING (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.premium_orders o WHERE o.id = order_id AND o.user_id = auth.uid())
  );
CREATE POLICY "order_messages_insert" ON public.order_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND (
      public.has_role(auth.uid(),'admin')
      OR EXISTS (SELECT 1 FROM public.premium_orders o WHERE o.id = order_id AND o.user_id = auth.uid())
    )
  );

-- ============ PIX SETTINGS (singleton) ============
CREATE TABLE public.pix_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pix_key TEXT NOT NULL DEFAULT '',
  pix_key_type TEXT NOT NULL DEFAULT 'email',
  recipient_name TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT 'Faça o PIX no valor exato e envie o comprovante no chat abaixo. Liberação manual em até 24h.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pix_settings TO anon, authenticated;
GRANT ALL ON public.pix_settings TO service_role;
ALTER TABLE public.pix_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pix_public_read" ON public.pix_settings FOR SELECT USING (true);
CREATE POLICY "pix_admin_write" ON public.pix_settings FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.pix_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ============ SEED ============
INSERT INTO public.categories (name, slug, icon, sort_order) VALUES
  ('Universal', 'universal', 'Globe', 1),
  ('Blox Fruits', 'blox-fruits', 'Swords', 2),
  ('Pet Simulator', 'pet-simulator', 'PawPrint', 3),
  ('Arsenal', 'arsenal', 'Crosshair', 4),
  ('Brookhaven', 'brookhaven', 'Home', 5),
  ('Da Hood', 'da-hood', 'Shield', 6);

INSERT INTO public.premium_plans (name, description, duration_days, price_brl, is_featured, sort_order, features) VALUES
  ('Premium 30 dias', 'Acesso a todos os scripts premium por 1 mês', 30, 19.90, true, 1,
    ARRAY['Acesso a TODOS os scripts premium','Sem encurtadores de link','Suporte prioritário','Atualizações em primeira mão']),
  ('Premium 90 dias', 'Economize comprando 3 meses', 90, 49.90, false, 2,
    ARRAY['Tudo do plano mensal','Economia de R$ 10','Selo Premium no perfil']),
  ('Premium Lifetime', 'Pague uma vez, use para sempre', 36500, 149.90, false, 3,
    ARRAY['Acesso vitalício','Todos os recursos','Selo Lifetime','Suporte VIP no Discord']);
