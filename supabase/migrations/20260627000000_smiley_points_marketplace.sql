-- Smiley Points (SP) marketplace integration
-- SP earning on purchase, review rewards, rank multipliers, spending

-- 1. Function to safely spend points (deducts from balance, validates sufficient funds)
CREATE OR REPLACE FUNCTION public.spend_points(
  p_user_id UUID,
  p_amount INT,
  p_reason TEXT,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_balance INT;
  result JSONB;
BEGIN
  SELECT balance INTO current_balance
  FROM public.user_points
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF current_balance IS NULL THEN
    RETURN jsonb_build_object('error', 'User has no points account');
  END IF;

  IF current_balance < p_amount THEN
    RETURN jsonb_build_object('error', 'Insufficient points', 'balance', current_balance, 'required', p_amount);
  END IF;

  UPDATE public.user_points
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.point_transactions (user_id, amount, reason, reference_type, reference_id)
  VALUES (p_user_id, -p_amount, p_reason, p_reference_type, p_reference_id);

  RETURN jsonb_build_object('ok', true, 'new_balance', current_balance - p_amount);
END;
$$;

GRANT EXECUTE ON FUNCTION public.spend_points TO service_role;

-- 2. Function to get user's rank info
CREATE OR REPLACE FUNCTION public.get_user_rank(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  lifetime INT;
  rank_name TEXT;
  multiplier NUMERIC(3,1);
  result JSONB;
BEGIN
  SELECT lifetime_earned INTO lifetime
  FROM public.user_points
  WHERE user_id = p_user_id;

  IF lifetime IS NULL THEN
    lifetime := 0;
  END IF;

  IF lifetime >= 10000 THEN
    rank_name := 'Elite';
    multiplier := 3.0;
  ELSIF lifetime >= 5000 THEN
    rank_name := 'Diamante';
    multiplier := 2.0;
  ELSIF lifetime >= 2000 THEN
    rank_name := 'Ouro';
    multiplier := 1.5;
  ELSIF lifetime >= 500 THEN
    rank_name := 'Prata';
    multiplier := 1.2;
  ELSE
    rank_name := 'Bronze';
    multiplier := 1.0;
  END IF;

  result := jsonb_build_object(
    'rank', rank_name,
    'multiplier', multiplier,
    'lifetime_earned', lifetime
  );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_rank TO service_role;
