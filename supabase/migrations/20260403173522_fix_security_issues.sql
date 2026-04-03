-- Fix 1: Add SET search_path to functions missing it
-- This prevents search path injection attacks

CREATE OR REPLACE FUNCTION public.calculate_penguin_stage(streak_days integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF streak_days >= 120 THEN RETURN 4;
  ELSIF streak_days >= 90 THEN RETURN 3;
  ELSIF streak_days >= 30 THEN RETURN 2;
  ELSIF streak_days >= 10 THEN RETURN 1;
  ELSE RETURN 0;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_trophy_level(wins integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF wins >= 5 THEN RETURN 5;
  ELSIF wins >= 4 THEN RETURN 4;
  ELSIF wins >= 3 THEN RETURN 3;
  ELSIF wins >= 2 THEN RETURN 2;
  ELSIF wins >= 1 THEN RETURN 1;
  ELSE RETURN 0;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reset_monthly_rescues()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.profiles
  SET rescues_remaining = 5,
      rescues_reset_date = (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::DATE
  WHERE rescues_reset_date <= CURRENT_DATE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.process_daily_bonus()
 RETURNS TABLE(points_earned integer, new_streak integer, is_in_danger boolean, was_rescued boolean)
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
  v_base_bonus INTEGER;
  v_streak_bonus INTEGER;
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

  -- Reset monthly rescues if needed
  PERFORM public.reset_monthly_rescues();

  -- Get current profile data
  SELECT login_streak, last_login, rescues_remaining, streak_in_danger
  INTO v_current_streak, v_last_login, v_rescues_remaining, v_in_danger
  FROM public.profiles
  WHERE id = v_user_id;

  v_is_in_danger := FALSE;

  -- If already logged in today, just return current state
  IF v_last_login = v_today THEN
    RETURN QUERY SELECT 0, v_current_streak, FALSE, FALSE;
    RETURN;
  END IF;

  -- Calculate new streak
  IF v_last_login = v_yesterday THEN
    -- Consecutive day login — streak continues
    v_current_streak := v_current_streak + 1;
    v_is_in_danger := FALSE;
  ELSIF v_last_login IS NULL THEN
    -- First ever login
    v_current_streak := 1;
    v_is_in_danger := FALSE;
  ELSIF v_in_danger AND v_last_login = v_yesterday - INTERVAL '1 day' THEN
    -- Was already in danger (missed 1 day before), now missed 2nd day — reset
    v_current_streak := 1;
    v_is_in_danger := FALSE;
  ELSIF v_last_login < v_yesterday THEN
    -- Missed exactly 1 day — put streak in danger (don't reset yet)
    -- Keep streak value but mark as in danger
    v_is_in_danger := TRUE;
    -- Don't increment streak — it stays at current value until rescued or lost
  END IF;

  -- Calculate bonus points
  v_base_bonus := 5;
  v_streak_bonus := FLOOR(v_current_streak / 7) * 2;
  v_points_earned := v_base_bonus + v_streak_bonus;

  -- Update profile
  UPDATE public.profiles
  SET login_streak = v_current_streak,
      last_login = v_today,
      points = points + v_points_earned,
      penguin_stage = public.calculate_penguin_stage(v_current_streak),
      streak_in_danger = v_is_in_danger
  WHERE id = v_user_id;

  -- Insert calendar entry
  INSERT INTO public.penguin_calendar (user_id, login_date)
  VALUES (v_user_id, v_today)
  ON CONFLICT DO NOTHING;

  -- Record transaction
  INSERT INTO internal.transactions (user_id, type, amount, streak)
  VALUES (v_user_id, 'daily_bonus', v_points_earned, v_current_streak);

  RETURN QUERY SELECT v_points_earned, v_current_streak, v_is_in_danger, v_was_rescued;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.use_rescue()
 RETURNS TABLE(success boolean, new_streak integer, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_rescues_remaining INTEGER;
  v_current_streak INTEGER;
BEGIN
  v_user_id := auth.uid();

  -- Reset monthly rescues if needed
  PERFORM public.reset_monthly_rescues();

  SELECT rescues_remaining, login_streak
  INTO v_rescues_remaining, v_current_streak
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_rescues_remaining <= 0 THEN
    RETURN QUERY SELECT FALSE, v_current_streak, 'No rescues remaining';
    RETURN;
  END IF;

  -- Consume rescue and clear danger
  UPDATE public.profiles
  SET rescues_remaining = rescues_remaining - 1,
      streak_in_danger = FALSE
  WHERE id = v_user_id;

  -- Record transaction
  INSERT INTO internal.transactions (user_id, type, amount, streak)
  VALUES (v_user_id, 'streak_rescue', 0, v_current_streak);

  RETURN QUERY SELECT TRUE, v_current_streak, 'Streak rescued!';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_win_streak(p_won boolean)
 RETURNS TABLE(new_win_streak integer, best_win_streak integer, new_trophy_level integer, points_earned integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_current_win_streak INTEGER;
  v_best_win_streak INTEGER;
  v_new_trophy_level INTEGER;
  v_points_earned INTEGER;
BEGIN
  v_user_id := auth.uid();

  SELECT win_streak, best_win_streak
  INTO v_current_win_streak, v_best_win_streak
  FROM public.profiles
  WHERE id = v_user_id;

  IF p_won THEN
    v_current_win_streak := v_current_win_streak + 1;
    IF v_current_win_streak > v_best_win_streak THEN
      v_best_win_streak := v_current_win_streak;
    END IF;
    v_points_earned := v_current_win_streak * 10;
  ELSE
    v_current_win_streak := 0;
    v_points_earned := 0;
  END IF;

  v_new_trophy_level := public.calculate_trophy_level(v_current_win_streak);

  UPDATE public.profiles
  SET win_streak = v_current_win_streak,
      best_win_streak = v_best_win_streak,
      trophy_level = v_new_trophy_level,
      points = points + v_points_earned
  WHERE id = v_user_id;

  IF p_won AND v_points_earned > 0 THEN
    INSERT INTO internal.transactions (user_id, type, amount, streak)
    VALUES (v_user_id, 'win_streak_bonus', v_points_earned, v_current_win_streak);
  END IF;

  RETURN QUERY SELECT v_current_win_streak, v_best_win_streak, v_new_trophy_level, v_points_earned;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_penguin_calendar()
 RETURNS TABLE(login_date date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  RETURN QUERY
  SELECT pc.login_date
  FROM public.penguin_calendar pc
  WHERE pc.user_id = v_user_id
    AND pc.login_date >= CURRENT_DATE - INTERVAL '30 days'
  ORDER BY pc.login_date DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_streak_data()
 RETURNS TABLE(out_login_streak integer, out_penguin_stage integer, out_win_streak integer, out_best_win_streak integer, out_trophy_level integer, out_rescues_remaining integer, out_streak_in_danger boolean, out_days_to_next_stage integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_current_streak INTEGER;
BEGIN
  v_user_id := auth.uid();
  PERFORM public.reset_monthly_rescues();
  SELECT p.login_streak, p.penguin_stage, p.win_streak, p.best_win_streak, p.trophy_level, p.rescues_remaining, p.streak_in_danger
  INTO out_login_streak, out_penguin_stage, out_win_streak, out_best_win_streak, out_trophy_level, out_rescues_remaining, out_streak_in_danger
  FROM public.profiles p
  WHERE p.id = v_user_id;
  v_current_streak := out_login_streak;
  IF v_current_streak >= 120 THEN
    out_days_to_next_stage := 0;
  ELSIF v_current_streak >= 90 THEN
    out_days_to_next_stage := 120 - v_current_streak;
  ELSIF v_current_streak >= 30 THEN
    out_days_to_next_stage := 90 - v_current_streak;
  ELSIF v_current_streak >= 10 THEN
    out_days_to_next_stage := 30 - v_current_streak;
  ELSE
    out_days_to_next_stage := 10 - v_current_streak;
  END IF;
  RETURN NEXT;
END;
$function$
;

-- Fix 2: Recreate transaction_history view as SECURITY INVOKER (default)
DROP VIEW IF EXISTS public.transaction_history;

CREATE VIEW public.transaction_history AS
  SELECT id,
         user_id,
         type,
         amount,
         bet_id,
         created_at
  FROM internal.transactions;

-- Fix 3: Add RLS policies for internal.transactions
CREATE POLICY "Users can view own transactions"
  ON internal.transactions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR created_by = auth.uid());

CREATE POLICY "System can insert transactions"
  ON internal.transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR created_by = auth.uid());
