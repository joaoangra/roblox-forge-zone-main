-- =====================================================
-- SMILEY POINTS ECONOMY REBALANCE
-- Caps, novos valores, anti-farming
-- =====================================================

-- 1. GLOBAL DAILY CAP CHECK
CREATE OR REPLACE FUNCTION public.check_sp_daily_limit(
  p_user_id UUID,
  p_amount INT,
  OUT allowed INT,
  OUT exceeded BOOLEAN
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_is_premium BOOLEAN;
  v_cap INT;
  v_today_spent INT;
BEGIN
  SELECT is_premium INTO v_is_premium FROM profiles WHERE id = p_user_id;
  v_cap := COALESCE(v_is_premium, false)::INT * 50 + 80;

  SELECT COALESCE(SUM(amount), 0) INTO v_today_spent
  FROM point_transactions
  WHERE user_id = p_user_id AND amount > 0 AND created_at::date = now()::date;

  IF v_today_spent + p_amount > v_cap THEN
    allowed := GREATEST(0, v_cap - v_today_spent);
    exceeded := true;
  ELSE
    allowed := p_amount;
    exceeded := false;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_sp_daily_limit TO service_role;

-- 2. CAPPED VERSION OF award_points
CREATE OR REPLACE FUNCTION public.award_points_capped(
  p_user_id UUID,
  p_amount INT,
  p_reason TEXT DEFAULT 'points',
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id TEXT DEFAULT NULL
) RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_allowed INT;
  v_exceeded BOOLEAN;
BEGIN
  IF p_amount <= 0 THEN RETURN 0; END IF;

  SELECT check_sp_daily_limit(p_user_id, p_amount) INTO v_allowed, v_exceeded;

  IF v_allowed <= 0 THEN RETURN 0; END IF;

  PERFORM award_points(p_user_id, v_allowed, p_reason, p_reference_type, p_reference_id);
  RETURN v_allowed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_points_capped TO service_role;

-- 3. REBALANCED SCRIPT UPLOAD POINTS
-- Basic=1, Good=3, Elite=6, NO premium multiplier
-- Cap via award_points_capped (global 80/130)
CREATE OR REPLACE FUNCTION calculate_script_upload_points(
  p_tier TEXT,
  p_daily_count INTEGER
) RETURNS INTEGER LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_base INTEGER;
  v_multiplier NUMERIC;
BEGIN
  v_base := CASE p_tier
    WHEN 'elite' THEN 6
    WHEN 'good' THEN 3
    WHEN 'basic' THEN 1
    ELSE 0
  END;
  IF v_base = 0 THEN RETURN 0; END IF;

  v_multiplier := CASE p_daily_count
    WHEN 0 THEN 1.0 WHEN 1 THEN 0.85 WHEN 2 THEN 0.70
    WHEN 3 THEN 0.55 WHEN 4 THEN 0.40
    ELSE 0.0
  END;

  RETURN GREATEST(0, ROUND(v_base * v_multiplier));
END;
$$;

-- 4. UPDATED TRIGGER TO USE CAPPED VERSION
CREATE OR REPLACE FUNCTION auto_award_script_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tier TEXT;
  v_daily_count INTEGER;
  v_points INTEGER;
  v_awarded INT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'approved' AND OLD.status != 'approved' AND NEW.user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_daily_count FROM point_transactions
    WHERE user_id = NEW.user_id AND reason LIKE 'Script%' AND created_at::date = now()::date;

    v_tier := calculate_script_tier(
      NEW.has_key, NEW.is_obfuscated,
      COALESCE(LENGTH(NEW.description), 0),
      NEW.thumbnail_url IS NOT NULL,
      COALESCE(array_length(NEW.supported_executors, 1), 0) > 0,
      COALESCE(NEW.quality_score, 0)
    );

    v_points := calculate_script_upload_points(v_tier, v_daily_count);

    IF v_points > 0 THEN
      v_awarded := award_points_capped(NEW.user_id, v_points,
        CASE v_tier
          WHEN 'elite' THEN 'Script Elite aprovado!'
          WHEN 'good' THEN 'Script Good aprovado!'
          ELSE 'Script Basic aprovado!'
        END,
        'script', NEW.id::text
      );
      UPDATE scripts SET points_rewarded = v_awarded WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 5. FEATURED POINTS ALSO GO THROUGH CAP
CREATE OR REPLACE FUNCTION auto_award_featured_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.is_featured AND NOT OLD.is_featured AND NEW.user_id IS NOT NULL THEN
    PERFORM award_points_capped(NEW.user_id, 25, 'Script em destaque!', 'script', NEW.id::text);
  END IF;
  RETURN NEW;
END;
$$;

-- 6. REBALANCED LOGIN REWARD (used by NOTIFICATIONS/display — actual JS handler uses inline calc)
CREATE OR REPLACE FUNCTION calculate_login_reward(p_streak INT)
RETURNS INT LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p_streak >= 30 THEN RETURN 30;
  ELSIF p_streak >= 7 THEN RETURN 10;
  ELSE RETURN 0;
  END IF;
END;
$$;

-- 7. REMOVE OBSOLETE get_daily_reward (replaced by inline logic)
DROP FUNCTION IF EXISTS public.get_daily_reward;
