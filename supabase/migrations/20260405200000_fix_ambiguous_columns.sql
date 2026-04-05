-- ============================================================================
-- FIX: Rename output columns to avoid ambiguity with table columns
-- ============================================================================
-- The original RETURNS TABLE used bare column names (id, username, points, etc.)
-- which conflicted with the profiles table columns in RETURN QUERY SELECT.
-- Renaming to out_* prefix resolves the "column reference is ambiguous" error.
-- ============================================================================

DROP FUNCTION IF EXISTS public.process_daily_bonus();
CREATE FUNCTION public.process_daily_bonus()
  RETURNS TABLE(
    out_id uuid,
    out_username text,
    out_points integer,
    out_is_admin boolean,
    out_last_login date,
    out_login_streak integer,
    out_created_at timestamp with time zone,
    out_rescues_remaining integer,
    out_rescues_reset_date date,
    out_penguin_stage integer,
    out_win_streak integer,
    out_best_win_streak integer,
    out_trophy_level integer,
    out_streak_in_danger boolean,
    out_points_earned integer,
    out_is_in_danger boolean,
    out_was_rescued boolean
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_current_streak INTEGER;
  v_last_login DATE;
  v_today DATE;
  v_yesterday DATE;
  v_points_earned INTEGER;
  v_is_in_danger BOOLEAN;
  v_was_rescued BOOLEAN;
  v_rescues_remaining INTEGER;
  v_in_danger BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  v_today := CURRENT_DATE;
  v_yesterday := CURRENT_DATE - INTERVAL '1 day';
  v_was_rescued := FALSE;

  PERFORM public.reset_monthly_rescues();

  SELECT p.login_streak, p.last_login, p.rescues_remaining, p.streak_in_danger
  INTO v_current_streak, v_last_login, v_rescues_remaining, v_in_danger
  FROM public.profiles p
  WHERE p.id = v_user_id;

  v_is_in_danger := FALSE;

  IF v_last_login = v_today THEN
    RETURN QUERY SELECT
      p.id, p.username, p.points, p.is_admin, p.last_login,
      p.login_streak, p.created_at, p.rescues_remaining, p.rescues_reset_date,
      p.penguin_stage, p.win_streak, p.best_win_streak, p.trophy_level,
      p.streak_in_danger,
      0, FALSE, FALSE
    FROM public.profiles p WHERE p.id = v_user_id;
    RETURN;
  END IF;

  IF v_last_login = v_yesterday THEN
    v_current_streak := v_current_streak + 1;
    v_is_in_danger := FALSE;
  ELSIF v_last_login IS NULL THEN
    v_current_streak := 1;
    v_is_in_danger := FALSE;
  ELSIF v_in_danger AND v_last_login = v_yesterday - INTERVAL '1 day' THEN
    v_current_streak := 1;
    v_is_in_danger := FALSE;
  ELSIF v_last_login < v_yesterday THEN
    v_is_in_danger := TRUE;
  END IF;

  v_points_earned := LEAST(v_current_streak * 5, 20);

  UPDATE public.profiles
  SET login_streak = v_current_streak,
      last_login = v_today,
      points = points + v_points_earned,
      penguin_stage = public.calculate_penguin_stage(v_current_streak),
      streak_in_danger = v_is_in_danger
  WHERE id = v_user_id;

  INSERT INTO public.penguin_calendar (user_id, login_date)
  VALUES (v_user_id, v_today)
  ON CONFLICT DO NOTHING;

  INSERT INTO internal.transactions (user_id, type, amount, streak)
  VALUES (v_user_id, 'daily_bonus', v_points_earned, v_current_streak);

  RETURN QUERY SELECT
    p.id, p.username, p.points, p.is_admin, p.last_login,
    p.login_streak, p.created_at, p.rescues_remaining, p.rescues_reset_date,
    p.penguin_stage, p.win_streak, p.best_win_streak, p.trophy_level,
    p.streak_in_danger,
    v_points_earned, v_is_in_danger, v_was_rescued
  FROM public.profiles p WHERE p.id = v_user_id;
END;
$function$
;
