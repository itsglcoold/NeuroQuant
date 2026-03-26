-- 007_analysis_ratelimit.sql
-- Add daily analysis call tracking to profiles

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS analysis_calls_today integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS analysis_reset_date  date    NOT NULL DEFAULT CURRENT_DATE;

-- Atomic rate-limit check + increment.
-- Returns: { allowed, used, limit }
-- p_daily_limit = -1 means unlimited (premium tier).
CREATE OR REPLACE FUNCTION public.check_and_increment_analysis(
  p_user_id     uuid,
  p_daily_limit integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_calls   integer;
  v_date    date;
BEGIN
  SELECT analysis_calls_today, analysis_reset_date
    INTO v_calls, v_date
    FROM public.profiles
   WHERE id = p_user_id
     FOR UPDATE;  -- row lock for atomicity

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'used', 0, 'limit', p_daily_limit, 'reason', 'profile_not_found');
  END IF;

  -- Reset counter if a new calendar day
  IF v_date < CURRENT_DATE THEN
    v_calls := 0;
    UPDATE public.profiles
       SET analysis_calls_today = 0,
           analysis_reset_date  = CURRENT_DATE
     WHERE id = p_user_id;
  END IF;

  -- Unlimited tier
  IF p_daily_limit = -1 THEN
    UPDATE public.profiles
       SET analysis_calls_today = v_calls + 1
     WHERE id = p_user_id;
    RETURN jsonb_build_object('allowed', true, 'used', v_calls + 1, 'limit', -1);
  END IF;

  -- Over limit
  IF v_calls >= p_daily_limit THEN
    RETURN jsonb_build_object('allowed', false, 'used', v_calls, 'limit', p_daily_limit);
  END IF;

  -- Increment and allow
  UPDATE public.profiles
     SET analysis_calls_today = v_calls + 1
   WHERE id = p_user_id;

  RETURN jsonb_build_object('allowed', true, 'used', v_calls + 1, 'limit', p_daily_limit);
END;
$$;
