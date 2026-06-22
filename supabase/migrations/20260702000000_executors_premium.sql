-- Premium Executors System
-- New columns for executors table
ALTER TABLE executors ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'unstable', 'offline'));
ALTER TABLE executors ADD COLUMN IF NOT EXISTS security_status TEXT NOT NULL DEFAULT 'undetected' CHECK (security_status IN ('undetected', 'medium_risk', 'detected'));
ALTER TABLE executors ADD COLUMN IF NOT EXISTS version TEXT;
ALTER TABLE executors ADD COLUMN IF NOT EXISTS key_system BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE executors ADD COLUMN IF NOT EXISTS official_site TEXT;
ALTER TABLE executors ADD COLUMN IF NOT EXISTS discord_url TEXT;
ALTER TABLE executors ADD COLUMN IF NOT EXISTS github_url TEXT;
ALTER TABLE executors ADD COLUMN IF NOT EXISTS tutorial_url TEXT;
ALTER TABLE executors ADD COLUMN IF NOT EXISTS downloads JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE executors ADD COLUMN IF NOT EXISTS trust_score INT DEFAULT 0;
ALTER TABLE executors ADD COLUMN IF NOT EXISTS trust_score_components JSONB;
ALTER TABLE executors ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 0;
ALTER TABLE executors ADD COLUMN IF NOT EXISTS likes_count INT NOT NULL DEFAULT 0;
ALTER TABLE executors ADD COLUMN IF NOT EXISTS dislikes_count INT NOT NULL DEFAULT 0;
ALTER TABLE executors ADD COLUMN IF NOT EXISTS liked_by UUID[] DEFAULT '{}';
ALTER TABLE executors ADD COLUMN IF NOT EXISTS disliked_by UUID[] DEFAULT '{}';
ALTER TABLE executors ADD COLUMN IF NOT EXISTS badges TEXT[] DEFAULT '{}';
ALTER TABLE executors ADD COLUMN IF NOT EXISTS rank INT;
ALTER TABLE executors ADD COLUMN IF NOT EXISTS developer TEXT;
ALTER TABLE executors ADD COLUMN IF NOT EXISTS execution_method TEXT;
ALTER TABLE executors ADD COLUMN IF NOT EXISTS requirements TEXT;
ALTER TABLE executors ADD COLUMN IF NOT EXISTS features TEXT[] DEFAULT '{}';
ALTER TABLE executors ADD COLUMN IF NOT EXISTS review_count INT NOT NULL DEFAULT 0;

-- Executor reviews table
CREATE TABLE IF NOT EXISTS executor_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  executor_id UUID NOT NULL REFERENCES executors(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  content TEXT,
  is_working BOOLEAN,
  is_detected BOOLEAN,
  has_bugs BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (executor_id, user_id)
);

GRANT SELECT ON executor_reviews TO authenticated;
GRANT INSERT ON executor_reviews TO authenticated;
GRANT ALL ON executor_reviews TO service_role;
ALTER TABLE executor_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_select" ON executor_reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert" ON executor_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_admin" ON executor_reviews FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Executor comments table
CREATE TABLE IF NOT EXISTS executor_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  executor_id UUID NOT NULL REFERENCES executors(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON executor_comments TO authenticated;
GRANT INSERT ON executor_comments TO authenticated;
GRANT ALL ON executor_comments TO service_role;
ALTER TABLE executor_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select" ON executor_comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON executor_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_admin" ON executor_comments FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Function to recalculate executor rating
CREATE OR REPLACE FUNCTION recalc_executor_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE executors SET
    rating = (SELECT COALESCE(AVG(rating), 0) FROM executor_reviews WHERE executor_id = COALESCE(NEW.executor_id, OLD.executor_id)),
    review_count = (SELECT COUNT(*) FROM executor_reviews WHERE executor_id = COALESCE(NEW.executor_id, OLD.executor_id))
  WHERE id = COALESCE(NEW.executor_id, OLD.executor_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_executor_rating ON executor_reviews;
CREATE TRIGGER trg_recalc_executor_rating
  AFTER INSERT OR UPDATE OR DELETE ON executor_reviews
  FOR EACH ROW EXECUTE FUNCTION recalc_executor_rating();
