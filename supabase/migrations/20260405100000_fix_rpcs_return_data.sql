-- ============================================================================
-- PERFORMANCE: Return data from RPCs to eliminate redundant re-fetches
-- ============================================================================
-- 1. process_daily_bonus() now returns the full updated profile row
--    Eliminates the 2nd SELECT in loadProfile()
-- 2. expire_resolution() now returns the updated bet row
--    Eliminates the re-fetch after auto-expiry
-- ============================================================================

-- 1. process_daily_bonus() — return full profile
DROP FUNCTION IF EXISTS public.process_daily_bonus();
CREATE FUNCTION public.process_daily_bonus()
  RETURNS TABLE(
    id uuid,
    username text,
    points integer,
    is_admin boolean,
    last_login date,
    login_streak integer,
    created_at timestamp with time zone,
    rescues_remaining integer,
    rescues_reset_date date,
    penguin_stage integer,
    win_streak integer,
    best_win_streak integer,
    trophy_level integer,
    streak_in_danger boolean,
    points_earned integer,
    is_in_danger boolean,
    was_rescued boolean
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
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

  SELECT login_streak, last_login, rescues_remaining, streak_in_danger
  INTO v_current_streak, v_last_login, v_rescues_remaining, v_in_danger
  FROM public.profiles
  WHERE id = v_user_id;

  v_is_in_danger := FALSE;

  IF v_last_login = v_today THEN
    -- Already logged in today, return current profile as-is
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

  -- Return the updated profile row
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

-- 2. expire_resolution() — return the updated bet row
DROP FUNCTION IF EXISTS public.expire_resolution(uuid);
CREATE FUNCTION public.expire_resolution(p_bet_id uuid)
  RETURNS SETOF public.bets
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_bet RECORD;
  v_wager RECORD;
BEGIN
  SELECT * INTO v_bet FROM public.bets WHERE id = p_bet_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bet not found';
  END IF;

  IF v_bet.status != 'published' THEN
    RAISE EXCEPTION 'Bet is not in published status';
  END IF;

  IF v_bet.end_time > NOW() THEN
    RAISE EXCEPTION 'Bet has not expired yet';
  END IF;

  UPDATE public.bets SET status = 'refunded', resolved_at = NOW() WHERE id = p_bet_id;

  FOR v_wager IN SELECT * FROM public.wagers WHERE bet_id = p_bet_id LOOP
    UPDATE public.profiles SET points = points + v_wager.amount WHERE id = v_wager.user_id;
    INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by, reason)
      VALUES (v_wager.user_id, 'wager_refund', v_wager.amount, p_bet_id, v_bet.creator_id, 'Bet expired - no resolution proposed');
  END LOOP;

  RETURN QUERY SELECT * FROM public.bets WHERE id = p_bet_id;
END;
$function$
;
