-- ============================================================================
-- ADMIN RPCs
-- ============================================================================
-- All functions check is_admin = true before proceeding.
-- SECURITY DEFINER bypasses RLS, so the admin check is critical.
-- ============================================================================

-- 1. admin_adjust_points — add/subtract points from any user
CREATE OR REPLACE FUNCTION public.admin_adjust_points(
  p_target_user_id uuid,
  p_amount integer,
  p_reason text DEFAULT NULL
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id UUID := auth.uid();
  v_is_admin BOOLEAN;
BEGIN
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = v_admin_id;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_amount = 0 THEN
    RAISE EXCEPTION 'Amount cannot be zero';
  END IF;

  UPDATE public.profiles SET points = points + p_amount WHERE id = p_target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  INSERT INTO internal.transactions (user_id, type, amount, created_by, reason)
  VALUES (p_target_user_id, 'adjustment', p_amount, v_admin_id, COALESCE(p_reason, 'Admin adjustment'));
END;
$function$
;

-- 2. admin_delete_bet — delete any bet (including published with wagers)
CREATE OR REPLACE FUNCTION public.admin_delete_bet(p_bet_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id UUID := auth.uid();
  v_is_admin BOOLEAN;
  v_bet RECORD;
  v_wager RECORD;
BEGIN
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = v_admin_id;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_bet FROM public.bets WHERE id = p_bet_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bet not found';
  END IF;

  -- Refund all wagers if any exist
  FOR v_wager IN SELECT * FROM public.wagers WHERE bet_id = p_bet_id LOOP
    UPDATE public.profiles SET points = points + v_wager.amount WHERE id = v_wager.user_id;
    INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by, reason)
      VALUES (v_wager.user_id, 'wager_refund', v_wager.amount, p_bet_id, v_admin_id, 'Bet deleted by admin');
  END LOOP;

  -- Refund creator fee if published
  IF v_bet.status = 'published' AND v_bet.fee_paid > 0 THEN
    UPDATE public.profiles SET points = points + v_bet.fee_paid WHERE id = v_bet.creator_id;
  END IF;

  -- Delete wagers then bet
  DELETE FROM public.wagers WHERE bet_id = p_bet_id;
  DELETE FROM public.bets WHERE id = p_bet_id;

  INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by, reason)
    VALUES (v_bet.creator_id, 'admin_bet_delete', 0, p_bet_id, v_admin_id, 'Bet deleted by admin');
END;
$function$
;

-- 3. admin_force_resolve — force-resolve a stuck bet (any status)
CREATE OR REPLACE FUNCTION public.admin_force_resolve(
  p_bet_id uuid,
  p_winner text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id UUID := auth.uid();
  v_is_admin BOOLEAN;
  v_bet RECORD;
  v_winner_total INTEGER := 0;
  v_creator_stake INTEGER;
  v_winnings NUMERIC;
  v_wager RECORD;
BEGIN
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = v_admin_id;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_winner NOT IN ('for', 'against', 'refund') THEN
    RAISE EXCEPTION 'Invalid winner. Must be "for", "against", or "refund"';
  END IF;

  SELECT * INTO v_bet FROM public.bets WHERE id = p_bet_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bet not found';
  END IF;

  IF v_bet.status = 'resolved' OR v_bet.status = 'refunded' THEN
    RAISE EXCEPTION 'Bet is already resolved';
  END IF;

  v_creator_stake := v_bet.stake;

  IF p_winner = 'refund' THEN
    -- Refund all wagers
    FOR v_wager IN SELECT * FROM public.wagers WHERE bet_id = p_bet_id LOOP
      UPDATE public.profiles SET points = points + v_wager.amount WHERE id = v_wager.user_id;
      INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by, reason)
        VALUES (v_wager.user_id, 'wager_refund', v_wager.amount, p_bet_id, v_admin_id, 'Bet refunded by admin');
    END LOOP;
    UPDATE public.bets SET status = 'refunded', resolved_at = NOW() WHERE id = p_bet_id;
  ELSE
    SELECT COALESCE(SUM(amount), 0) INTO v_winner_total FROM public.wagers WHERE bet_id = p_bet_id AND side = p_winner;

    FOR v_wager IN SELECT * FROM public.wagers WHERE bet_id = p_bet_id AND side = p_winner LOOP
      v_winnings := v_wager.amount + (CASE WHEN v_winner_total > 0 THEN (v_wager.amount::NUMERIC / v_winner_total * v_creator_stake) ELSE 0 END);
      UPDATE public.profiles SET points = points + FLOOR(v_winnings) WHERE id = v_wager.user_id;
      INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by)
        VALUES (v_wager.user_id, 'win', FLOOR(v_winnings), p_bet_id, v_admin_id);
    END LOOP;

    FOR v_wager IN SELECT * FROM public.wagers WHERE bet_id = p_bet_id AND side != p_winner LOOP
      INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by)
        VALUES (v_wager.user_id, 'loss', -v_wager.amount, p_bet_id, v_admin_id);
    END LOOP;

    UPDATE public.bets SET status = 'resolved', winner = p_winner, resolved_at = NOW() WHERE id = p_bet_id;
  END IF;

  INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by, reason)
    VALUES (v_bet.creator_id, 'admin_resolve', 0, p_bet_id, v_admin_id, 'Bet resolved by admin');
END;
$function$
;

-- 4. admin_get_stats — return platform-wide statistics
CREATE OR REPLACE FUNCTION public.admin_get_stats()
  RETURNS TABLE(
    total_users bigint,
    active_bets bigint,
    resolved_bets bigint,
    refunded_bets bigint,
    total_points bigint,
    total_wagers bigint,
    pending_courts bigint,
    today_logins bigint
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id UUID := auth.uid();
  v_is_admin BOOLEAN;
BEGIN
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = v_admin_id;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT COUNT(*) INTO total_users FROM public.profiles;
  SELECT COUNT(*) INTO active_bets FROM public.bets WHERE status = 'published';
  SELECT COUNT(*) INTO resolved_bets FROM public.bets WHERE status = 'resolved';
  SELECT COUNT(*) INTO refunded_bets FROM public.bets WHERE status = 'refunded';
  SELECT COALESCE(SUM(points), 0) INTO total_points FROM public.profiles;
  SELECT COUNT(*) INTO total_wagers FROM public.wagers;
  SELECT COUNT(*) INTO pending_courts FROM public.bet_resolutions WHERE status IN ('proposed', 'challenged', 'voting');
  SELECT COUNT(*) INTO today_logins FROM public.penguin_calendar WHERE login_date = CURRENT_DATE;

  RETURN NEXT;
END;
$function$
;
