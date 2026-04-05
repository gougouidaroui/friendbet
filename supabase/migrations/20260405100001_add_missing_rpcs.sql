-- ============================================================================
-- PERFORMANCE: Add missing RPCs (delete_bet, update_bet)
-- ============================================================================
-- These were called from the frontend but didn't exist in the DB.
-- Now they exist, fixing broken features.
-- ============================================================================

-- 1. delete_bet() — delete a bet
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
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bet not found';
  END IF;

  IF v_bet.creator_id != v_user_id THEN
    RAISE EXCEPTION 'Only the creator can delete this bet';
  END IF;

  IF v_bet.status = 'draft' THEN
    -- Drafts can be freely deleted
    DELETE FROM public.bets WHERE id = p_bet_id;
  ELSIF v_bet.status = 'published' THEN
    -- Check if anyone has wagered
    SELECT COUNT(*) INTO v_wager_count FROM public.wagers WHERE bet_id = p_bet_id;
    IF v_wager_count > 0 THEN
      RAISE EXCEPTION 'Cannot delete a bet that has wagers';
    END IF;
    -- Refund the fee
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

-- 2. update_bet() — update bet fields (drafts only)
CREATE OR REPLACE FUNCTION public.update_bet(
  p_bet_id uuid,
  p_title text,
  p_description text,
  p_duration integer,
  p_stake integer,
  p_visibility text
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
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bet not found';
  END IF;

  IF v_bet.creator_id != v_user_id THEN
    RAISE EXCEPTION 'Only the creator can update this bet';
  END IF;

  IF v_bet.status != 'draft' THEN
    RAISE EXCEPTION 'Only draft bets can be updated';
  END IF;

  v_old_fee := v_bet.fee_paid;
  v_new_fee := 10 + p_duration;
  v_fee_diff := v_new_fee - v_old_fee;

  -- If fee changed and bet was published, adjust points
  IF v_fee_diff != 0 THEN
    DECLARE
      v_profile RECORD;
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

  UPDATE public.bets
  SET title = p_title,
      description = p_description,
      duration = p_duration,
      stake = p_stake,
      visibility = p_visibility,
      end_time = NOW() + (p_duration || ' hours')::INTERVAL,
      fee_paid = v_new_fee
  WHERE id = p_bet_id;
END;
$function$
;
