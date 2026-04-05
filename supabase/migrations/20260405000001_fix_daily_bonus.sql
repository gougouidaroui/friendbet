-- Fix daily bonus calculation
-- Old: base 5 + FLOOR(streak/7)*2 (wrong)
-- New: streak * 5, capped at 20

CREATE OR REPLACE FUNCTION public.process_daily_bonus()
 RETURNS TABLE(points_earned integer, new_streak integer, is_in_danger boolean, was_rescued boolean)
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
    RETURN QUERY SELECT 0, v_current_streak, FALSE, FALSE;
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

  -- New bonus: streak * 5, capped at 20
  -- Day 1 = 5, Day 2 = 10, Day 3 = 15, Day 4+ = 20
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

  RETURN QUERY SELECT v_points_earned, v_current_streak, v_is_in_danger, v_was_rescued;
END;
$function$
;
