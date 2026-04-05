-- ============================================================================
-- FIX: Add SET search_path TO 'public' to all SECURITY DEFINER functions
-- that are missing it. This prevents search_path injection attacks.
-- ============================================================================

-- process_daily_bonus (already fixed in 20260405200000, but ensure it's correct)
-- expire_resolution
CREATE OR REPLACE FUNCTION public.expire_resolution(p_bet_id uuid)
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

-- propose_resolution
CREATE OR REPLACE FUNCTION public.propose_resolution(p_bet_id uuid, p_outcome text)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_bet RECORD;
  v_resolution_id UUID;
  v_proposal_fee INTEGER := 25;
  v_profile RECORD;
  v_is_participant BOOLEAN;
BEGIN
  IF p_outcome NOT IN ('for', 'against') THEN
    RAISE EXCEPTION 'Invalid outcome. Must be "for" or "against"';
  END IF;

  SELECT * INTO v_bet FROM public.bets WHERE id = p_bet_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bet not found'; END IF;

  IF v_bet.status != 'published' THEN RAISE EXCEPTION 'Bet is not open for resolution'; END IF;
  IF v_bet.end_time > NOW() THEN RAISE EXCEPTION 'Bet has not expired yet'; END IF;

  v_is_participant := (v_bet.creator_id = v_user_id) OR
    EXISTS (SELECT 1 FROM public.wagers WHERE bet_id = p_bet_id AND user_id = v_user_id);
  IF NOT v_is_participant THEN RAISE EXCEPTION 'Only bet participants can propose a resolution'; END IF;

  IF EXISTS (SELECT 1 FROM public.bet_resolutions WHERE bet_id = p_bet_id AND status NOT IN ('expired', 'completed')) THEN
    RAISE EXCEPTION 'Bet already has an active resolution';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  IF v_profile.points < v_proposal_fee THEN
    RAISE EXCEPTION 'Insufficient points for proposal fee (need %)', v_proposal_fee;
  END IF;

  INSERT INTO public.bet_resolutions (bet_id, status, proposed_by, proposed_outcome, proposed_at, proposal_fee)
  VALUES (p_bet_id, 'proposed', v_user_id, p_outcome, NOW(), v_proposal_fee)
  RETURNING id INTO v_resolution_id;

  UPDATE public.profiles SET points = points - v_proposal_fee WHERE id = v_user_id;
  INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by, reason)
    VALUES (v_user_id, 'resolution_proposal', -v_proposal_fee, p_bet_id, v_user_id, 'Proposal fee');

  UPDATE public.bets SET status = 'in_resolution' WHERE id = p_bet_id;

  RETURN v_resolution_id;
END;
$function$
;

-- challenge_resolution
CREATE OR REPLACE FUNCTION public.challenge_resolution(p_bet_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_bet RECORD;
  v_resolution RECORD;
  v_is_participant BOOLEAN;
BEGIN
  SELECT * INTO v_bet FROM public.bets WHERE id = p_bet_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bet not found'; END IF;

  SELECT * INTO v_resolution FROM public.bet_resolutions WHERE bet_id = p_bet_id AND status = 'proposed';
  IF NOT FOUND THEN RAISE EXCEPTION 'No active proposal to challenge'; END IF;

  v_is_participant := (v_bet.creator_id = v_user_id) OR
    EXISTS (SELECT 1 FROM public.wagers WHERE bet_id = p_bet_id AND user_id = v_user_id);
  IF NOT v_is_participant THEN RAISE EXCEPTION 'Only bet participants can challenge'; END IF;

  UPDATE public.bet_resolutions SET status = 'challenged', challenged_by = v_user_id, challenged_at = NOW()
  WHERE id = v_resolution.id;

  INSERT INTO public.notifications (user_id, type, from_user_id, bet_id)
  VALUES (v_resolution.proposed_by, 'bet_resolved', v_user_id, p_bet_id);
END;
$function$
;

-- start_court_voting
CREATE OR REPLACE FUNCTION public.start_court_voting(p_bet_id uuid)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_bet RECORD;
  v_resolution RECORD;
  v_resolution_id UUID;
BEGIN
  SELECT * INTO v_bet FROM public.bets WHERE id = p_bet_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bet not found'; END IF;

  SELECT * INTO v_resolution FROM public.bet_resolutions WHERE bet_id = p_bet_id AND status = 'challenged';
  IF NOT FOUND THEN RAISE EXCEPTION 'No challenged resolution found'; END IF;

  IF v_bet.creator_id != v_user_id AND v_resolution.challenged_by != v_user_id THEN
    RAISE EXCEPTION 'Only creator or challenger can start voting';
  END IF;

  UPDATE public.bet_resolutions SET status = 'voting' WHERE id = v_resolution.id RETURNING id INTO v_resolution_id;

  RETURN v_resolution_id;
END;
$function$
;

-- submit_vote_commit
CREATE OR REPLACE FUNCTION public.submit_vote_commit(p_resolution_id uuid, p_commit_hash text)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_resolution RECORD;
  v_bet RECORD;
  v_is_participant BOOLEAN;
  v_juror_stake INTEGER := 100;
  v_profile RECORD;
  v_existing_commit RECORD;
BEGIN
  SELECT * INTO v_resolution FROM public.bet_resolutions WHERE id = p_resolution_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Resolution not found'; END IF;
  IF v_resolution.status != 'voting' THEN RAISE EXCEPTION 'Resolution is not in voting phase'; END IF;

  SELECT * INTO v_bet FROM public.bets WHERE id = v_resolution.bet_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bet not found'; END IF;

  v_is_participant := (v_bet.creator_id = v_user_id) OR
    EXISTS (SELECT 1 FROM public.wagers WHERE bet_id = v_bet.id AND user_id = v_user_id);
  IF NOT v_is_participant THEN RAISE EXCEPTION 'Only bet participants can vote'; END IF;

  SELECT * INTO v_existing_commit FROM public.court_votes WHERE resolution_id = p_resolution_id AND user_id = v_user_id;
  IF FOUND THEN
    IF v_existing_commit.revealed THEN RAISE EXCEPTION 'Vote already revealed'; END IF;
    RAISE EXCEPTION 'Vote already committed';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  IF v_profile.points < v_juror_stake THEN RAISE EXCEPTION 'Insufficient points for juror stake (need %)', v_juror_stake; END IF;

  UPDATE public.profiles SET points = points - v_juror_stake WHERE id = v_user_id;
  INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by, reason)
    VALUES (v_user_id, 'court_stake', -v_juror_stake, v_bet.id, v_user_id, 'Court vote stake');

  INSERT INTO public.court_votes (resolution_id, user_id, commit_hash, stake_amount)
    VALUES (p_resolution_id, v_user_id, p_commit_hash, v_juror_stake);
END;
$function$
;

-- submit_vote_reveal
CREATE OR REPLACE FUNCTION public.submit_vote_reveal(p_resolution_id uuid, p_vote_side text)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_vote RECORD;
  v_resolution RECORD;
BEGIN
  SELECT * INTO v_vote FROM public.court_votes WHERE resolution_id = p_resolution_id AND user_id = v_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'No committed vote found'; END IF;
  IF v_vote.revealed THEN RAISE EXCEPTION 'Vote already revealed'; END IF;

  SELECT * INTO v_resolution FROM public.bet_resolutions WHERE id = p_resolution_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Resolution not found'; END IF;

  IF p_vote_side NOT IN ('for', 'against') THEN RAISE EXCEPTION 'Invalid vote side'; END IF;

  UPDATE public.court_votes SET vote_side = p_vote_side, revealed = true, revealed_at = NOW() WHERE id = v_vote.id;
END;
$function$
;

-- resolve_court
CREATE OR REPLACE FUNCTION public.resolve_court(p_bet_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_bet RECORD;
  v_resolution RECORD;
  v_for_count INTEGER := 0;
  v_against_count INTEGER := 0;
  v_total_voters INTEGER := 0;
  v_for_stakes_total INTEGER := 0;
  v_against_stakes_total INTEGER := 0;
  v_court_winner text;
  v_voter RECORD;
  v_wager RECORD;
  v_creator_stake INTEGER;
  v_winner_total NUMERIC := 0;
  v_winnings NUMERIC;
  v_proposer RECORD;
BEGIN
  SELECT * INTO v_bet FROM public.bets WHERE id = p_bet_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bet not found'; END IF;

  SELECT * INTO v_resolution FROM public.bet_resolutions WHERE bet_id = p_bet_id AND status IN ('voting', 'challenged');
  IF NOT FOUND THEN RAISE EXCEPTION 'No active resolution found'; END IF;

  IF v_bet.creator_id != v_user_id AND v_resolution.challenged_by != v_user_id THEN
    RAISE EXCEPTION 'Only creator or challenger can resolve court';
  END IF;

  SELECT COUNT(*) INTO v_total_voters FROM public.court_votes WHERE resolution_id = v_resolution.id AND revealed = true;
  SELECT COUNT(*) INTO v_for_count FROM public.court_votes WHERE resolution_id = v_resolution.id AND revealed = true AND vote_side = 'for';
  SELECT COUNT(*) INTO v_against_count FROM public.court_votes WHERE resolution_id = v_resolution.id AND revealed = true AND vote_side = 'against';
  SELECT COALESCE(SUM(stake_amount), 0) INTO v_for_stakes_total FROM public.court_votes WHERE resolution_id = v_resolution.id AND revealed = true AND vote_side = 'for';
  SELECT COALESCE(SUM(stake_amount), 0) INTO v_against_stakes_total FROM public.court_votes WHERE resolution_id = v_resolution.id AND revealed = true AND vote_side = 'against';

  IF v_total_voters = 0 THEN
    v_court_winner := 'refund';
  ELSIF v_for_count = v_against_count THEN
    v_court_winner := 'refund';
  ELSIF v_for_count > v_against_count THEN
    v_court_winner := 'for';
  ELSE
    v_court_winner := 'against';
  END IF;

  UPDATE public.bet_resolutions SET status = 'completed', court_winner = v_court_winner, resolved_at = NOW() WHERE id = v_resolution.id;

  IF v_court_winner = 'refund' THEN
    FOR v_voter IN SELECT * FROM public.court_votes WHERE resolution_id = v_resolution.id LOOP
      UPDATE public.profiles SET points = points + v_voter.stake_amount WHERE id = v_voter.user_id;
      INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by, reason)
        VALUES (v_voter.user_id, 'court_refund', v_voter.stake_amount, v_bet.id, v_user_id, 'Court vote stake refunded');
    END LOOP;
    FOR v_wager IN SELECT * FROM public.wagers WHERE bet_id = p_bet_id LOOP
      UPDATE public.profiles SET points = points + v_wager.amount WHERE id = v_wager.user_id;
      INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by, reason)
        VALUES (v_wager.user_id, 'wager_refund', v_wager.amount, p_bet_id, v_user_id, 'Bet refunded - court tie');
    END LOOP;
    IF v_resolution.proposal_fee > 0 AND v_resolution.proposed_by IS NOT NULL THEN
      UPDATE public.profiles SET points = points + v_resolution.proposal_fee WHERE id = v_resolution.proposed_by;
    END IF;
    UPDATE public.bets SET status = 'refunded', resolved_at = NOW() WHERE id = p_bet_id;
  ELSE
    FOR v_voter IN SELECT * FROM public.court_votes WHERE resolution_id = v_resolution.id AND revealed = true LOOP
      IF v_voter.vote_side = v_court_winner THEN
        IF v_for_stakes_total + v_against_stakes_total - (
          SELECT COALESCE(SUM(stake_amount), 0) FROM public.court_votes
          WHERE resolution_id = v_resolution.id AND revealed = true AND vote_side = v_court_winner
        ) > 0 THEN
          DECLARE
            v_losing_stakes INTEGER;
            v_winning_stakes INTEGER;
            v_payout NUMERIC;
          BEGIN
            SELECT COALESCE(SUM(stake_amount), 0) INTO v_losing_stakes FROM public.court_votes
              WHERE resolution_id = v_resolution.id AND revealed = true AND vote_side != v_court_winner;
            SELECT COALESCE(SUM(stake_amount), 0) INTO v_winning_stakes FROM public.court_votes
              WHERE resolution_id = v_resolution.id AND revealed = true AND vote_side = v_court_winner;
            v_payout := v_voter.stake_amount + (v_voter.stake_amount::NUMERIC / v_winning_stakes * v_losing_stakes);
            UPDATE public.profiles SET points = points + FLOOR(v_payout) WHERE id = v_voter.user_id;
            INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by, reason)
              VALUES (v_voter.user_id, 'court_win', FLOOR(v_payout), v_bet.id, v_user_id, 'Court vote winnings');
          END;
        ELSE
          UPDATE public.profiles SET points = points + v_voter.stake_amount WHERE id = v_voter.user_id;
          INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by, reason)
            VALUES (v_voter.user_id, 'court_refund', v_voter.stake_amount, v_bet.id, v_user_id, 'Court vote stake refunded');
        END IF;
      ELSE
        INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by, reason)
          VALUES (v_voter.user_id, 'court_loss', -v_voter.stake_amount, v_bet.id, v_user_id, 'Court vote lost');
      END IF;
    END LOOP;

    SELECT * INTO v_proposer FROM public.profiles WHERE id = v_resolution.proposed_by;
    IF v_resolution.proposed_outcome = v_court_winner AND v_resolution.proposal_fee > 0 THEN
      UPDATE public.profiles SET points = points + v_resolution.proposal_fee WHERE id = v_resolution.proposed_by;
      INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by, reason)
        VALUES (v_resolution.proposed_by, 'court_proposal_refund', v_resolution.proposal_fee, v_bet.id, v_user_id, 'Proposal fee refunded');
    END IF;

    v_creator_stake := v_bet.stake;
    SELECT COALESCE(SUM(amount), 0) INTO v_winner_total FROM public.wagers WHERE bet_id = p_bet_id AND side = v_court_winner;

    FOR v_wager IN SELECT * FROM public.wagers WHERE bet_id = p_bet_id AND side = v_court_winner LOOP
      v_winnings := v_wager.amount + (CASE WHEN v_winner_total > 0 THEN (v_wager.amount::NUMERIC / v_winner_total * v_creator_stake) ELSE 0 END);
      UPDATE public.profiles SET points = points + FLOOR(v_winnings) WHERE id = v_wager.user_id;
      INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by)
        VALUES (v_wager.user_id, 'win', FLOOR(v_winnings), p_bet_id, v_user_id);
      INSERT INTO public.notifications (user_id, type, from_user_id, bet_id)
        VALUES (v_wager.user_id, 'bet_resolved', v_user_id, p_bet_id);
    END LOOP;

    FOR v_wager IN SELECT * FROM public.wagers WHERE bet_id = p_bet_id AND side != v_court_winner LOOP
      INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by)
        VALUES (v_wager.user_id, 'loss', -v_wager.amount, p_bet_id, v_user_id);
      INSERT INTO public.notifications (user_id, type, from_user_id, bet_id)
        VALUES (v_wager.user_id, 'bet_resolved', v_user_id, p_bet_id);
    END LOOP;

    UPDATE public.bets SET status = 'resolved', winner = v_court_winner, resolved_at = NOW() WHERE id = p_bet_id;
  END IF;
END;
$function$
;

-- get_resolution_info
CREATE OR REPLACE FUNCTION public.get_resolution_info(p_bet_id uuid)
  RETURNS TABLE(
    resolution_id uuid, status text, proposed_by uuid, proposed_by_username text,
    proposed_outcome text, proposed_at timestamp with time zone, challenged_by uuid,
    challenged_by_username text, challenged_at timestamp with time zone, court_winner text,
    resolved_at timestamp with time zone, proposal_fee integer, total_voters integer,
    for_votes integer, against_votes integer, user_has_committed boolean,
    user_has_revealed boolean, user_vote_side text
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_resolution RECORD;
  v_for_count INTEGER;
  v_against_count INTEGER;
  v_total INTEGER;
  v_user_commit RECORD;
BEGIN
  SELECT * INTO v_resolution FROM public.bet_resolutions WHERE bet_id = p_bet_id ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::uuid, NULL::text, NULL::text,
      NULL::timestamptz, NULL::uuid, NULL::text, NULL::timestamptz, NULL::text,
      NULL::timestamptz, 0, 0, 0, 0, false, false, NULL::text;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_total FROM public.court_votes WHERE resolution_id = v_resolution.id AND revealed = true;
  SELECT COUNT(*) INTO v_for_count FROM public.court_votes WHERE resolution_id = v_resolution.id AND revealed = true AND vote_side = 'for';
  SELECT COUNT(*) INTO v_against_count FROM public.court_votes WHERE resolution_id = v_resolution.id AND revealed = true AND vote_side = 'against';
  SELECT * INTO v_user_commit FROM public.court_votes WHERE resolution_id = v_resolution.id AND user_id = v_user_id;

  RETURN QUERY SELECT v_resolution.id, v_resolution.status, v_resolution.proposed_by,
    (SELECT username FROM public.profiles WHERE id = v_resolution.proposed_by),
    v_resolution.proposed_outcome, v_resolution.proposed_at, v_resolution.challenged_by,
    (SELECT username FROM public.profiles WHERE id = v_resolution.challenged_by),
    v_resolution.challenged_at, v_resolution.court_winner, v_resolution.resolved_at,
    v_resolution.proposal_fee, v_total, v_for_count, v_against_count,
    (v_user_commit IS NOT NULL), (v_user_commit IS NOT NULL AND v_user_commit.revealed = true),
    v_user_commit.vote_side;
END;
$function$
;

-- get_court_participants
CREATE OR REPLACE FUNCTION public.get_court_participants(p_bet_id uuid)
  RETURNS TABLE(user_id uuid, username text, side text, amount integer,
    has_committed boolean, has_revealed boolean, vote_side text)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_resolution_id UUID;
BEGIN
  SELECT id INTO v_resolution_id FROM public.bet_resolutions WHERE bet_id = p_bet_id ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  RETURN QUERY SELECT b.creator_id, p.username, 'creator'::text, 0,
    (cv.id IS NOT NULL), (cv.revealed = true), cv.vote_side
  FROM public.bets b JOIN public.profiles p ON p.id = b.creator_id
  LEFT JOIN public.court_votes cv ON cv.resolution_id = v_resolution_id AND cv.user_id = b.creator_id
  WHERE b.id = p_bet_id;

  RETURN QUERY SELECT w.user_id, p.username, w.side, w.amount,
    (cv.id IS NOT NULL), (cv.revealed = true), cv.vote_side
  FROM public.wagers w JOIN public.profiles p ON p.id = w.user_id
  LEFT JOIN public.court_votes cv ON cv.resolution_id = v_resolution_id AND cv.user_id = w.user_id
  WHERE w.bet_id = p_bet_id;
END;
$function$
;

-- decline_friend_request
CREATE OR REPLACE FUNCTION public.decline_friend_request(p_friendship_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_friendship RECORD;
BEGIN
  SELECT * INTO v_friendship FROM public.friendships WHERE id = p_friendship_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Friendship not found'; END IF;
  IF v_friendship.addressee_id != v_user_id THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_friendship.status != 'pending' THEN RAISE EXCEPTION 'Request not pending'; END IF;

  UPDATE public.friendships SET status = 'declined' WHERE id = p_friendship_id;

  INSERT INTO public.notifications (user_id, type, from_user_id)
  VALUES (v_friendship.requester_id, 'friend_declined', v_user_id);
END;
$function$
;

-- calculate_penguin_stage
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

-- calculate_trophy_level
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

-- get_streak_data
CREATE OR REPLACE FUNCTION public.get_streak_data()
  RETURNS TABLE(out_login_streak integer, out_penguin_stage integer, out_win_streak integer,
    out_best_win_streak integer, out_trophy_level integer, out_rescues_remaining integer,
    out_streak_in_danger boolean, out_days_to_next_stage integer)
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
  SELECT p.login_streak, p.penguin_stage, p.win_streak, p.best_win_streak, p.trophy_level,
    p.rescues_remaining, p.streak_in_danger
  INTO out_login_streak, out_penguin_stage, out_win_streak, out_best_win_streak,
    out_trophy_level, out_rescues_remaining, out_streak_in_danger
  FROM public.profiles p WHERE p.id = v_user_id;
  v_current_streak := out_login_streak;
  IF v_current_streak >= 120 THEN out_days_to_next_stage := 0;
  ELSIF v_current_streak >= 90 THEN out_days_to_next_stage := 120 - v_current_streak;
  ELSIF v_current_streak >= 30 THEN out_days_to_next_stage := 90 - v_current_streak;
  ELSIF v_current_streak >= 10 THEN out_days_to_next_stage := 30 - v_current_streak;
  ELSE out_days_to_next_stage := 10 - v_current_streak;
  END IF;
  RETURN NEXT;
END;
$function$
;

-- handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, username, points)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)), 5000);
  INSERT INTO internal.transactions (user_id, type, amount, created_by)
  VALUES (NEW.id, 'initial', 5000, NEW.id);
  RETURN NEW;
END;
$function$
;

-- is_friend
CREATE OR REPLACE FUNCTION public.is_friend(user1 uuid, user2 uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
    AND ((requester_id = user1 AND addressee_id = user2) OR (requester_id = user2 AND addressee_id = user1))
  );
$function$
;

-- place_wager
CREATE OR REPLACE FUNCTION public.place_wager(p_bet_id uuid, p_side text, p_amount integer)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_bet RECORD;
  v_profile RECORD;
BEGIN
  IF p_side NOT IN ('for', 'against') THEN RAISE EXCEPTION 'Invalid side'; END IF;

  SELECT * INTO v_bet FROM public.bets WHERE id = p_bet_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bet not found'; END IF;
  IF v_bet.status != 'published' THEN RAISE EXCEPTION 'Bet is not open for wagers'; END IF;
  IF v_bet.end_time < NOW() THEN RAISE EXCEPTION 'Bet has expired'; END IF;
  IF v_bet.creator_id = v_user_id THEN RAISE EXCEPTION 'Cannot wager on your own bet'; END IF;
  IF EXISTS (SELECT 1 FROM public.wagers WHERE bet_id = p_bet_id AND user_id = v_user_id) THEN
    RAISE EXCEPTION 'Already wagered on this bet';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF p_amount > v_profile.points THEN RAISE EXCEPTION 'Insufficient points'; END IF;

  INSERT INTO public.wagers (bet_id, user_id, side, amount) VALUES (p_bet_id, v_user_id, p_side, p_amount);
  UPDATE public.profiles SET points = points - p_amount WHERE id = v_user_id;
  INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by)
    VALUES (v_user_id, 'wager', -p_amount, p_bet_id, v_user_id);
END;
$function$
;

-- process_daily_bonus (re-declare with search_path)
DROP FUNCTION IF EXISTS public.process_daily_bonus();
CREATE FUNCTION public.process_daily_bonus()
  RETURNS TABLE(
    out_id uuid, out_username text, out_points integer, out_is_admin boolean,
    out_last_login date, out_login_streak integer, out_created_at timestamp with time zone,
    out_rescues_remaining integer, out_rescues_reset_date date, out_penguin_stage integer,
    out_win_streak integer, out_best_win_streak integer, out_trophy_level integer,
    out_streak_in_danger boolean, out_points_earned integer, out_is_in_danger boolean,
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
  FROM public.profiles p WHERE p.id = v_user_id;

  v_is_in_danger := FALSE;

  IF v_last_login = v_today THEN
    RETURN QUERY SELECT p.id, p.username, p.points, p.is_admin, p.last_login,
      p.login_streak, p.created_at, p.rescues_remaining, p.rescues_reset_date,
      p.penguin_stage, p.win_streak, p.best_win_streak, p.trophy_level,
      p.streak_in_danger, 0, FALSE, FALSE
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

  UPDATE public.profiles SET login_streak = v_current_streak, last_login = v_today,
    points = points + v_points_earned,
    penguin_stage = public.calculate_penguin_stage(v_current_streak),
    streak_in_danger = v_is_in_danger WHERE id = v_user_id;

  INSERT INTO public.penguin_calendar (user_id, login_date) VALUES (v_user_id, v_today) ON CONFLICT DO NOTHING;
  INSERT INTO internal.transactions (user_id, type, amount, streak)
    VALUES (v_user_id, 'daily_bonus', v_points_earned, v_current_streak);

  RETURN QUERY SELECT p.id, p.username, p.points, p.is_admin, p.last_login,
    p.login_streak, p.created_at, p.rescues_remaining, p.rescues_reset_date,
    p.penguin_stage, p.win_streak, p.best_win_streak, p.trophy_level,
    p.streak_in_danger, v_points_earned, v_is_in_danger, v_was_rescued
  FROM public.profiles p WHERE p.id = v_user_id;
END;
$function$
;

-- remove_friend
CREATE OR REPLACE FUNCTION public.remove_friend(p_friendship_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.friendships WHERE id = p_friendship_id
    AND (requester_id = v_user_id OR addressee_id = v_user_id)) THEN
    RAISE EXCEPTION 'Friendship not found or unauthorized';
  END IF;
  DELETE FROM public.friendships WHERE id = p_friendship_id;
END;
$function$
;

-- reset_monthly_rescues
CREATE OR REPLACE FUNCTION public.reset_monthly_rescues()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.profiles SET rescues_remaining = 5,
    rescues_reset_date = (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::DATE
  WHERE rescues_reset_date <= CURRENT_DATE;
END;
$function$
;

-- resolve_bet
CREATE OR REPLACE FUNCTION public.resolve_bet(p_bet_id uuid, p_winner text)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_bet RECORD;
  v_winner_total INTEGER := 0;
  v_creator_stake INTEGER;
  v_winnings NUMERIC;
  v_wager RECORD;
BEGIN
  IF p_winner NOT IN ('for', 'against') THEN RAISE EXCEPTION 'Invalid winner'; END IF;

  SELECT * INTO v_bet FROM public.bets WHERE id = p_bet_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bet not found'; END IF;
  IF v_bet.creator_id != v_user_id THEN RAISE EXCEPTION 'Only the creator can resolve the bet'; END IF;
  IF v_bet.status != 'published' THEN RAISE EXCEPTION 'Bet cannot be resolved'; END IF;

  IF v_bet.end_time > NOW() AND v_bet.stake > 0 THEN
    RAISE EXCEPTION 'Bet has not expired yet';
  END IF;

  v_creator_stake := v_bet.stake;
  SELECT COALESCE(SUM(amount), 0) INTO v_winner_total FROM public.wagers WHERE bet_id = p_bet_id AND side = p_winner;

  FOR v_wager IN SELECT * FROM public.wagers WHERE bet_id = p_bet_id AND side = p_winner LOOP
    v_winnings := v_wager.amount + (CASE WHEN v_winner_total > 0 THEN (v_wager.amount::NUMERIC / v_winner_total * v_creator_stake) ELSE 0 END);
    UPDATE public.profiles SET points = points + FLOOR(v_winnings) WHERE id = v_wager.user_id;
    INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by)
      VALUES (v_wager.user_id, 'win', FLOOR(v_winnings), p_bet_id, v_user_id);
    INSERT INTO public.notifications (user_id, type, from_user_id, bet_id)
      VALUES (v_wager.user_id, 'bet_resolved', v_user_id, p_bet_id);
  END LOOP;

  FOR v_wager IN SELECT * FROM public.wagers WHERE bet_id = p_bet_id AND side != p_winner LOOP
    INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by)
      VALUES (v_wager.user_id, 'loss', -v_wager.amount, p_bet_id, v_user_id);
    INSERT INTO public.notifications (user_id, type, from_user_id, bet_id)
      VALUES (v_wager.user_id, 'bet_resolved', v_user_id, p_bet_id);
  END LOOP;

  UPDATE public.bets SET status = 'resolved', winner = p_winner, resolved_at = NOW() WHERE id = p_bet_id;
END;
$function$
;

-- rls_auto_enable
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
  RETURNS event_trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
    AND object_type IN ('table','partitioned table')
  LOOP
    IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public')
      AND cmd.schema_name NOT IN ('pg_catalog','information_schema')
      AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%'
    THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
    END IF;
  END LOOP;
END;
$function$
;

-- send_friend_request
CREATE OR REPLACE FUNCTION public.send_friend_request(p_addressee_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF p_addressee_id = v_user_id THEN RAISE EXCEPTION 'Cannot friend yourself'; END IF;
  IF EXISTS (SELECT 1 FROM public.friendships
    WHERE (requester_id = v_user_id AND addressee_id = p_addressee_id)
    OR (requester_id = p_addressee_id AND addressee_id = v_user_id)) THEN
    RAISE EXCEPTION 'Friendship already exists or is pending';
  END IF;

  INSERT INTO public.friendships (requester_id, addressee_id) VALUES (v_user_id, p_addressee_id);
  INSERT INTO public.notifications (user_id, type, from_user_id)
    VALUES (p_addressee_id, 'friend_request', v_user_id);
END;
$function$
;

-- accept_friend_request
CREATE OR REPLACE FUNCTION public.accept_friend_request(p_friendship_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_friendship RECORD;
BEGIN
  SELECT * INTO v_friendship FROM public.friendships WHERE id = p_friendship_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Friendship not found'; END IF;
  IF v_friendship.addressee_id != v_user_id THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_friendship.status != 'pending' THEN RAISE EXCEPTION 'Request not pending'; END IF;

  UPDATE public.friendships SET status = 'accepted' WHERE id = p_friendship_id;
  INSERT INTO public.notifications (user_id, type, from_user_id)
    VALUES (v_friendship.requester_id, 'friend_accepted', v_user_id);
END;
$function$
;

-- update_win_streak
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
  SELECT win_streak, best_win_streak INTO v_current_win_streak, v_best_win_streak
  FROM public.profiles WHERE id = v_user_id;

  IF p_won THEN
    v_current_win_streak := v_current_win_streak + 1;
    IF v_current_win_streak > v_best_win_streak THEN v_best_win_streak := v_current_win_streak; END IF;
    v_points_earned := v_current_win_streak * 10;
  ELSE
    v_current_win_streak := 0;
    v_points_earned := 0;
  END IF;

  v_new_trophy_level := public.calculate_trophy_level(v_current_win_streak);

  UPDATE public.profiles SET win_streak = v_current_win_streak, best_win_streak = v_best_win_streak,
    trophy_level = v_new_trophy_level, points = points + v_points_earned WHERE id = v_user_id;

  IF p_won AND v_points_earned > 0 THEN
    INSERT INTO internal.transactions (user_id, type, amount, streak)
    VALUES (v_user_id, 'win_streak_bonus', v_points_earned, v_current_win_streak);
  END IF;

  RETURN QUERY SELECT v_current_win_streak, v_best_win_streak, v_new_trophy_level, v_points_earned;
END;
$function$
;

-- use_rescue
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
  PERFORM public.reset_monthly_rescues();

  SELECT rescues_remaining, login_streak INTO v_rescues_remaining, v_current_streak
  FROM public.profiles WHERE id = v_user_id;

  IF v_rescues_remaining <= 0 THEN
    RETURN QUERY SELECT FALSE, v_current_streak, 'No rescues remaining';
    RETURN;
  END IF;

  UPDATE public.profiles SET rescues_remaining = rescues_remaining - 1, streak_in_danger = FALSE
  WHERE id = v_user_id;

  INSERT INTO internal.transactions (user_id, type, amount, streak)
  VALUES (v_user_id, 'streak_rescue', 0, v_current_streak);

  RETURN QUERY SELECT TRUE, v_current_streak, 'Streak rescued!';
END;
$function$
;

-- create_bet
CREATE OR REPLACE FUNCTION public.create_bet(
  p_title text, p_description text, p_duration integer, p_stake integer,
  p_visibility text DEFAULT 'public'::text, p_publish boolean DEFAULT false
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_bet_id UUID;
  v_fee INTEGER;
  v_profile RECORD;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;

  v_fee := 10 + p_duration;
  IF p_publish AND v_profile.points < v_fee THEN RAISE EXCEPTION 'Insufficient points. Need %', v_fee; END IF;

  INSERT INTO public.bets (title, description, duration, stake, creator_id, end_time, status, fee_paid, visibility)
  VALUES (p_title, p_description, p_duration, p_stake, v_user_id,
    NOW() + (p_duration || ' hours')::INTERVAL,
    CASE WHEN p_publish THEN 'published' ELSE 'draft' END,
    CASE WHEN p_publish THEN v_fee ELSE 0 END, p_visibility)
  RETURNING id INTO v_bet_id;

  IF p_publish THEN
    UPDATE public.profiles SET points = points - v_fee WHERE id = v_user_id;
    INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by)
    VALUES (v_user_id, 'bet_created', -v_fee, v_bet_id, v_user_id);
  END IF;

  RETURN v_bet_id;
END;
$function$
;

-- get_penguin_calendar
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
  RETURN QUERY SELECT pc.login_date FROM public.penguin_calendar pc
  WHERE pc.user_id = v_user_id AND pc.login_date >= CURRENT_DATE - INTERVAL '30 days'
  ORDER BY pc.login_date DESC;
END;
$function$
;

-- publish_bet
CREATE OR REPLACE FUNCTION public.publish_bet(p_bet_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_bet RECORD;
  v_fee INTEGER;
  v_profile RECORD;
BEGIN
  SELECT * INTO v_bet FROM public.bets WHERE id = p_bet_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bet not found'; END IF;
  IF v_bet.creator_id != v_user_id THEN RAISE EXCEPTION 'Only the creator can publish this bet'; END IF;
  IF v_bet.status != 'draft' THEN RAISE EXCEPTION 'Only draft bets can be published'; END IF;

  v_fee := 10 + v_bet.duration;
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  IF v_profile.points < v_fee THEN RAISE EXCEPTION 'Insufficient points. Need %', v_fee; END IF;

  UPDATE public.bets SET status = 'published', end_time = NOW() + (v_bet.duration || ' hours')::INTERVAL,
    fee_paid = v_fee WHERE id = p_bet_id;

  UPDATE public.profiles SET points = points - v_fee WHERE id = v_user_id;
  INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by)
  VALUES (v_user_id, 'bet_created', -v_fee, p_bet_id, v_user_id);
END;
$function$
;

-- update_bet
CREATE OR REPLACE FUNCTION public.update_bet(
  p_bet_id uuid, p_title text, p_description text, p_duration integer,
  p_stake integer, p_visibility text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_bet RECORD;
  v_old_fee INTEGER;
  v_new_fee INTEGER;
  v_fee_diff INTEGER;
BEGIN
  SELECT * INTO v_bet FROM public.bets WHERE id = p_bet_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bet not found'; END IF;
  IF v_bet.creator_id != v_user_id THEN RAISE EXCEPTION 'Only the creator can update this bet'; END IF;
  IF v_bet.status != 'draft' THEN RAISE EXCEPTION 'Only draft bets can be updated'; END IF;

  v_old_fee := v_bet.fee_paid;
  v_new_fee := 10 + p_duration;
  v_fee_diff := v_new_fee - v_old_fee;

  IF v_fee_diff != 0 THEN
    DECLARE v_profile RECORD;
    BEGIN
      SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
      IF v_fee_diff > 0 AND v_profile.points < v_fee_diff THEN
        RAISE EXCEPTION 'Insufficient points for fee increase. Need %', v_fee_diff;
      END IF;
      UPDATE public.profiles SET points = points - v_fee_diff WHERE id = v_user_id;
      IF v_fee_diff != 0 THEN
        INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by, reason)
        VALUES (v_user_id, 'bet_fee_adjustment', -v_fee_diff, p_bet_id, v_user_id, 'Bet updated - fee adjusted');
      END IF;
    END;
  END IF;

  UPDATE public.bets SET title = p_title, description = p_description, duration = p_duration,
    stake = p_stake, visibility = p_visibility,
    end_time = NOW() + (p_duration || ' hours')::INTERVAL, fee_paid = v_new_fee
  WHERE id = p_bet_id;
END;
$function$
;

-- delete_bet
CREATE OR REPLACE FUNCTION public.delete_bet(p_bet_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_bet RECORD;
  v_wager_count INTEGER;
BEGIN
  SELECT * INTO v_bet FROM public.bets WHERE id = p_bet_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bet not found'; END IF;
  IF v_bet.creator_id != v_user_id THEN RAISE EXCEPTION 'Only the creator can delete this bet'; END IF;

  IF v_bet.status = 'draft' THEN
    DELETE FROM public.bets WHERE id = p_bet_id;
  ELSIF v_bet.status = 'published' THEN
    SELECT COUNT(*) INTO v_wager_count FROM public.wagers WHERE bet_id = p_bet_id;
    IF v_wager_count > 0 THEN RAISE EXCEPTION 'Cannot delete a bet that has wagers'; END IF;
    UPDATE public.profiles SET points = points + v_bet.fee_paid WHERE id = v_user_id;
    INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by, reason)
    VALUES (v_user_id, 'bet_deleted', v_bet.fee_paid, p_bet_id, v_user_id, 'Bet deleted - fee refunded');
    DELETE FROM public.bets WHERE id = p_bet_id;
  ELSE
    RAISE EXCEPTION 'Cannot delete a bet that is already resolved or in resolution';
  END IF;
END;
$function$
;
