
-- Enums
DO $$ BEGIN CREATE TYPE public.seller_level AS ENUM ('bronze','silver','gold','diamond','elite'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.kyc_status AS ENUM ('none','pending','approved','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.listing_status AS ENUM ('draft','pending_review','active','paused','sold_out','rejected','removed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.delivery_type AS ENUM ('manual','instant_code','service'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.mp_order_status AS ENUM ('awaiting_payment','paid','delivered','released','disputed','refunded','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.dispute_status AS ENUM ('open','under_review','resolved_buyer','resolved_seller','closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.wallet_tx_type AS ENUM ('credit','debit','hold','release','withdrawal','commission','refund','adjustment'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.withdrawal_status AS ENUM ('requested','approved','paid','rejected','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.ticket_category AS ENUM ('support','financial','dispute','sales','bug','security'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.ticket_status AS ENUM ('open','in_progress','waiting_user','resolved','closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.report_target AS ENUM ('listing','user','review','message'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.seller_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT, bio TEXT, avatar_url TEXT, banner_url TEXT,
  kyc_status public.kyc_status NOT NULL DEFAULT 'none',
  verified BOOLEAN NOT NULL DEFAULT false,
  level public.seller_level NOT NULL DEFAULT 'bronze',
  rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  total_reviews INT NOT NULL DEFAULT 0,
  total_sales INT NOT NULL DEFAULT 0,
  total_cancelled INT NOT NULL DEFAULT 0,
  response_time_minutes INT,
  risk_score INT NOT NULL DEFAULT 0,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seller_profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.seller_profiles TO authenticated;
GRANT ALL ON public.seller_profiles TO service_role;
ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sp_public_select" ON public.seller_profiles FOR SELECT USING (true);
CREATE POLICY "sp_own" ON public.seller_profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sp_admin" ON public.seller_profiles FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.kyc_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL, document_type TEXT NOT NULL, document_number TEXT NOT NULL,
  document_front_url TEXT, document_back_url TEXT, selfie_url TEXT,
  status public.kyc_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES auth.users(id), reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.kyc_verifications TO authenticated;
GRANT ALL ON public.kyc_verifications TO service_role;
ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kyc_own_select" ON public.kyc_verifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kyc_own_insert" ON public.kyc_verifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kyc_admin" ON public.kyc_verifications FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.marketplace_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, icon TEXT,
  parent_id UUID REFERENCES public.marketplace_categories(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0, active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketplace_categories TO anon, authenticated;
GRANT ALL ON public.marketplace_categories TO service_role;
ALTER TABLE public.marketplace_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mc_public" ON public.marketplace_categories FOR SELECT USING (true);
CREATE POLICY "mc_admin" ON public.marketplace_categories FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.marketplace_categories (slug,name,icon,sort_order) VALUES
  ('itens','Itens Roblox','package',1),
  ('game-passes','Game Passes','ticket',2),
  ('servicos','Serviços','briefcase',3)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.marketplace_categories(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
  short_description TEXT, description TEXT NOT NULL,
  game_name TEXT,
  delivery_type public.delivery_type NOT NULL DEFAULT 'manual',
  price_cents INT NOT NULL, original_price_cents INT,
  stock INT NOT NULL DEFAULT 1, unlimited_stock BOOLEAN NOT NULL DEFAULT false,
  cover_image_url TEXT, video_url TEXT, tags TEXT[],
  status public.listing_status NOT NULL DEFAULT 'pending_review',
  rejection_reason TEXT,
  views INT NOT NULL DEFAULT 0, sales_count INT NOT NULL DEFAULT 0,
  rating NUMERIC(3,2) NOT NULL DEFAULT 0, total_reviews INT NOT NULL DEFAULT 0,
  featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lst_public" ON public.listings FOR SELECT USING (status = 'active' OR auth.uid() = seller_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "lst_seller" ON public.listings FOR ALL USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "lst_admin" ON public.listings FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_listings_status ON public.listings(status);
CREATE INDEX idx_listings_category ON public.listings(category_id);
CREATE INDEX idx_listings_seller ON public.listings(seller_id);

CREATE TABLE public.listing_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL, sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.listing_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.listing_images TO authenticated;
GRANT ALL ON public.listing_images TO service_role;
ALTER TABLE public.listing_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "li_public" ON public.listing_images FOR SELECT USING (true);
CREATE POLICY "li_seller" ON public.listing_images FOR ALL
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.seller_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.seller_id = auth.uid()));
CREATE POLICY "li_admin" ON public.listing_images FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.listing_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL, answer TEXT, answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.listing_questions TO anon;
GRANT SELECT, INSERT, UPDATE ON public.listing_questions TO authenticated;
GRANT ALL ON public.listing_questions TO service_role;
ALTER TABLE public.listing_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lq_public" ON public.listing_questions FOR SELECT USING (true);
CREATE POLICY "lq_insert" ON public.listing_questions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lq_seller_answer" ON public.listing_questions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.seller_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.seller_id = auth.uid()));

CREATE TABLE public.marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents INT NOT NULL, gateway_fee_cents INT NOT NULL DEFAULT 0,
  platform_fee_cents INT NOT NULL DEFAULT 0, seller_amount_cents INT NOT NULL,
  status public.mp_order_status NOT NULL DEFAULT 'awaiting_payment',
  payment_method TEXT NOT NULL DEFAULT 'pix',
  payment_proof_url TEXT,
  delivered_at TIMESTAMPTZ, auto_release_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ, cancelled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.marketplace_orders TO authenticated;
GRANT ALL ON public.marketplace_orders TO service_role;
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mo_parties" ON public.marketplace_orders FOR SELECT USING (auth.uid() IN (buyer_id, seller_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "mo_create" ON public.marketplace_orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "mo_update" ON public.marketplace_orders FOR UPDATE USING (auth.uid() IN (buyer_id, seller_id) OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.marketplace_chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL, seller_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.marketplace_chat_rooms TO authenticated;
GRANT ALL ON public.marketplace_chat_rooms TO service_role;
ALTER TABLE public.marketplace_chat_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cr_parties" ON public.marketplace_chat_rooms FOR SELECT USING (auth.uid() IN (buyer_id, seller_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "cr_insert" ON public.marketplace_chat_rooms FOR INSERT WITH CHECK (auth.uid() IN (buyer_id, seller_id));

CREATE TABLE public.marketplace_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.marketplace_chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT, attachment_url TEXT, attachment_type TEXT,
  system_message BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.marketplace_chat_messages TO authenticated;
GRANT ALL ON public.marketplace_chat_messages TO service_role;
ALTER TABLE public.marketplace_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cm_read" ON public.marketplace_chat_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.marketplace_chat_rooms r WHERE r.id = room_id AND (auth.uid() IN (r.buyer_id, r.seller_id) OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "cm_send" ON public.marketplace_chat_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.marketplace_chat_rooms r WHERE r.id = room_id AND auth.uid() IN (r.buyer_id, r.seller_id)));

CREATE TABLE public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  opened_by UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  status public.dispute_status NOT NULL DEFAULT 'open',
  resolution_note TEXT,
  resolved_by UUID REFERENCES auth.users(id), resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.disputes TO authenticated;
GRANT ALL ON public.disputes TO service_role;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dsp_read" ON public.disputes FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.marketplace_orders o WHERE o.id = order_id AND (auth.uid() IN (o.buyer_id,o.seller_id) OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "dsp_open" ON public.disputes FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.marketplace_orders o WHERE o.id = order_id AND auth.uid() IN (o.buyer_id,o.seller_id)));
CREATE POLICY "dsp_admin_upd" ON public.disputes FOR UPDATE USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.dispute_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT, attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.dispute_messages TO authenticated;
GRANT ALL ON public.dispute_messages TO service_role;
ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dm_read" ON public.dispute_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.disputes d JOIN public.marketplace_orders o ON o.id = d.order_id
    WHERE d.id = dispute_id AND (auth.uid() IN (o.buyer_id,o.seller_id) OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "dm_send" ON public.dispute_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.disputes d JOIN public.marketplace_orders o ON o.id = d.order_id
    WHERE d.id = dispute_id AND (auth.uid() IN (o.buyer_id,o.seller_id) OR public.has_role(auth.uid(),'admin'))));

CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  available_cents BIGINT NOT NULL DEFAULT 0,
  pending_cents BIGINT NOT NULL DEFAULT 0,
  blocked_cents BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "w_own" ON public.wallets FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "w_admin" ON public.wallets FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.wallet_tx_type NOT NULL,
  amount_cents BIGINT NOT NULL,
  description TEXT,
  related_order_id UUID REFERENCES public.marketplace_orders(id) ON DELETE SET NULL,
  related_withdrawal_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wt_own" ON public.wallet_transactions FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL,
  pix_key TEXT NOT NULL, pix_key_type TEXT NOT NULL,
  status public.withdrawal_status NOT NULL DEFAULT 'requested',
  receipt_url TEXT, admin_note TEXT,
  processed_by UUID REFERENCES auth.users(id), processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wd_own" ON public.withdrawals FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "wd_req" ON public.withdrawals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wd_admin" ON public.withdrawals FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rv_public" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "rv_buyer" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = buyer_id);

CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category public.ticket_category NOT NULL,
  subject TEXT NOT NULL,
  status public.ticket_status NOT NULL DEFAULT 'open',
  related_order_id UUID REFERENCES public.marketplace_orders(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tk_own" ON public.tickets FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "tk_open" ON public.tickets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tk_admin_upd" ON public.tickets FOR UPDATE USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL, attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ticket_messages TO authenticated;
GRANT ALL ON public.ticket_messages TO service_role;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tm_read" ON public.ticket_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "tm_send" ON public.ticket_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type public.report_target NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT NOT NULL, details TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  reviewed_by UUID REFERENCES auth.users(id), reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rp_own" ON public.reports FOR SELECT USING (auth.uid() = reporter_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "rp_insert" ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "rp_admin" ON public.reports FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, entity_type TEXT, entity_id UUID,
  metadata JSONB, ip_address TEXT, user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "al_admin" ON public.audit_logs FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "al_ins" ON public.audit_logs FOR INSERT WITH CHECK (auth.uid() = actor_id);

CREATE TRIGGER trg_seller_profiles_upd BEFORE UPDATE ON public.seller_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_kyc_upd BEFORE UPDATE ON public.kyc_verifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_mp_categories_upd BEFORE UPDATE ON public.marketplace_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_listings_upd BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_mp_orders_upd BEFORE UPDATE ON public.marketplace_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_disputes_upd BEFORE UPDATE ON public.disputes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_wallets_upd BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_withdrawals_upd BEFORE UPDATE ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tickets_upd BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.ensure_wallet_for_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.wallets(user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_profile_created_create_wallet ON public.profiles;
CREATE TRIGGER on_profile_created_create_wallet
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.ensure_wallet_for_user();

INSERT INTO public.wallets(user_id)
SELECT id FROM public.profiles ON CONFLICT (user_id) DO NOTHING;
