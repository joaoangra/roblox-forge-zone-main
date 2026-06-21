-- Script Submission & Points Rewards
-- Migration 20260622000000
-- Adds user-submitted scripts and daily login rewards - integrates with existing user_points/point_transactions

-- 1. PROFILES — daily login tracking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_login_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_reward TIMESTAMPTZ;

-- 2. SCRIPTS — novos campos para submissão de usuários
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected'));
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 0;
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS points_rewarded INTEGER DEFAULT 0;
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS supported_executors TEXT[] DEFAULT '{}';
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS has_key BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS is_obfuscated BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS game_link TEXT;
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

DROP INDEX IF EXISTS idx_scripts_user_id;
CREATE INDEX IF NOT EXISTS idx_scripts_user_id ON scripts(user_id);
DROP INDEX IF EXISTS idx_scripts_status;
CREATE INDEX IF NOT EXISTS idx_scripts_status ON scripts(status);
DROP INDEX IF EXISTS idx_scripts_quality_score;
CREATE INDEX IF NOT EXISTS idx_scripts_quality_score ON scripts(quality_score);

-- 3. FUNCTIONS

CREATE OR REPLACE FUNCTION calculate_script_tier(
  p_has_key BOOLEAN,
  p_is_obfuscated BOOLEAN,
  p_description_length INTEGER,
  p_has_image BOOLEAN,
  p_has_executors BOOLEAN,
  p_quality_score INTEGER
) RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p_quality_score >= 80 AND NOT p_has_key AND NOT p_is_obfuscated AND p_description_length > 200 AND p_has_image AND p_has_executors THEN
    RETURN 'elite';
  ELSIF p_quality_score >= 50 AND p_has_image AND p_has_executors AND p_description_length > 100 THEN
    RETURN 'good';
  ELSE
    RETURN 'basic';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_script_upload_points(
  p_tier TEXT,
  p_is_premium BOOLEAN,
  p_daily_count INTEGER
) RETURNS INTEGER LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_base INTEGER;
  v_multiplier NUMERIC := 1.0;
  v_diminishing NUMERIC;
BEGIN
  v_base := CASE p_tier
    WHEN 'elite' THEN 10
    WHEN 'good' THEN 5
    WHEN 'basic' THEN 2
    ELSE 0
  END;
  IF p_is_premium THEN v_multiplier := 1.5; END IF;
  IF p_is_premium THEN
    v_diminishing := CASE p_daily_count
      WHEN 0 THEN 1.0 WHEN 1 THEN 0.95 WHEN 2 THEN 0.90
      WHEN 3 THEN 0.85 WHEN 4 THEN 0.80 WHEN 5 THEN 0.70
      WHEN 6 THEN 0.60 WHEN 7 THEN 0.50 WHEN 8 THEN 0.40
      WHEN 9 THEN 0.30
      ELSE 0.0
    END;
  ELSE
    v_diminishing := CASE p_daily_count
      WHEN 0 THEN 1.0 WHEN 1 THEN 0.8 WHEN 2 THEN 0.6
      ELSE 0.0
    END;
  END IF;
  RETURN GREATEST(0, ROUND(v_base * v_multiplier * v_diminishing));
END;
$$;

CREATE OR REPLACE FUNCTION calculate_login_reward(p_streak INTEGER)
RETURNS INTEGER LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN CASE p_streak
    WHEN 1 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 3
    WHEN 4 THEN 4 WHEN 5 THEN 5 WHEN 6 THEN 6
    ELSE 10
  END;
END;
$$;

-- 4. TRIGGERS

-- Auto-award points when script is approved (uses existing award_points())
CREATE OR REPLACE FUNCTION auto_award_script_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tier TEXT;
  v_is_premium BOOLEAN;
  v_daily_count INTEGER;
  v_points INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'approved' AND OLD.status != 'approved' AND NEW.user_id IS NOT NULL THEN
    SELECT is_premium INTO v_is_premium FROM profiles WHERE id = NEW.user_id;
    IF v_is_premium IS NULL THEN v_is_premium := false; END IF;

    SELECT COUNT(*) INTO v_daily_count FROM point_transactions
    WHERE user_id = NEW.user_id AND reason LIKE 'Script%' AND created_at::date = now()::date;

    v_tier := calculate_script_tier(
      NEW.has_key, NEW.is_obfuscated,
      COALESCE(LENGTH(NEW.description), 0),
      NEW.thumbnail_url IS NOT NULL,
      COALESCE(array_length(NEW.supported_executors, 1), 0) > 0,
      COALESCE(NEW.quality_score, 0)
    );

    v_points := calculate_script_upload_points(v_tier, v_is_premium, v_daily_count);

    IF v_points > 0 THEN
      PERFORM award_points(NEW.user_id, v_points,
        CASE v_tier
          WHEN 'elite' THEN 'Script Elite aprovado!'
          WHEN 'good' THEN 'Script Good aprovado!'
          ELSE 'Script Basic aprovado!'
        END,
        'script', NEW.id::text
      );
      UPDATE scripts SET points_rewarded = v_points WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_award_script_points ON scripts;
CREATE TRIGGER trg_auto_award_script_points
  AFTER UPDATE OF status ON scripts
  FOR EACH ROW EXECUTE FUNCTION auto_award_script_points();

-- Auto-award when script gets featured
CREATE OR REPLACE FUNCTION auto_award_featured_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.is_featured AND NOT OLD.is_featured AND NEW.user_id IS NOT NULL THEN
    PERFORM award_points(NEW.user_id, 25, 'Script em destaque!', 'script', NEW.id::text);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_award_featured_points ON scripts;
CREATE TRIGGER trg_auto_award_featured_points
  AFTER UPDATE OF is_featured ON scripts
  FOR EACH ROW EXECUTE FUNCTION auto_award_featured_points();
