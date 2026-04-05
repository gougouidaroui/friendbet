-- ============================================================================
-- JUROR COURT SYSTEM - Autonomous Bet Resolution
-- ============================================================================
-- Replaces manual creator-based resolution with a trust & betrayal game
-- among bet participants.
-- ============================================================================

-- New status values for bets: add 'in_resolution' and 'refunded'
ALTER TABLE "public"."bets" DROP CONSTRAINT IF EXISTS "bets_status_check";
ALTER TABLE "public"."bets" ADD CONSTRAINT "bets_status_check" CHECK (
  status = ANY (ARRAY[
    'draft'::text,
    'published'::text,
    'in_resolution'::text,
    'resolved'::text,
    'refunded'::text
  ])
);

-- ============================================================================
-- TABLE: bet_resolutions
-- Tracks the resolution state of each bet
-- ============================================================================
CREATE TABLE "public"."bet_resolutions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "bet_id" uuid NOT NULL,
  "status" text NOT NULL DEFAULT 'pending'::text,
  "proposed_by" uuid,
  "proposed_outcome" text,
  "proposed_at" timestamp with time zone,
  "challenged_by" uuid,
  "challenged_at" timestamp with time zone,
  "court_winner" text,
  "resolved_at" timestamp with time zone,
  "proposal_fee" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),

  CONSTRAINT "bet_resolutions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bet_resolutions_bet_id_key" UNIQUE ("bet_id"),
  CONSTRAINT "bet_resolutions_status_check" CHECK (
    status = ANY (ARRAY[
      'pending'::text,
      'proposed'::text,
      'challenged'::text,
      'voting'::text,
      'voted'::text,
      'completed'::text,
      'expired'::text
    ])
  ),
  CONSTRAINT "bet_resolutions_outcome_check" CHECK (
    proposed_outcome IS NULL OR proposed_outcome = ANY (ARRAY['for'::text, 'against'::text])
  ),
  CONSTRAINT "bet_resolutions_court_winner_check" CHECK (
    court_winner IS NULL OR court_winner = ANY (ARRAY['for'::text, 'against'::text, 'refund'::text])
  ),
  CONSTRAINT "bet_resolutions_bet_id_fkey" FOREIGN KEY ("bet_id")
    REFERENCES "public"."bets"("id") ON DELETE CASCADE,
  CONSTRAINT "bet_resolutions_proposed_by_fkey" FOREIGN KEY ("proposed_by")
    REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
  CONSTRAINT "bet_resolutions_challenged_by_fkey" FOREIGN KEY ("challenged_by")
    REFERENCES "public"."profiles"("id") ON DELETE SET NULL
);

ALTER TABLE "public"."bet_resolutions" ENABLE ROW LEVEL SECURITY;

CREATE INDEX "idx_bet_resolutions_bet_id" ON "public"."bet_resolutions" USING btree ("bet_id");
CREATE INDEX "idx_bet_resolutions_status" ON "public"."bet_resolutions" USING btree ("status");

-- ============================================================================
-- TABLE: court_votes
-- Commit-reveal votes from bet participants
-- ============================================================================
CREATE TABLE "public"."court_votes" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "resolution_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "commit_hash" text NOT NULL,
  "vote_side" text,
  "revealed" boolean DEFAULT false,
  "stake_amount" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "revealed_at" timestamp with time zone,

  CONSTRAINT "court_votes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "court_votes_resolution_user_key" UNIQUE ("resolution_id", "user_id"),
  CONSTRAINT "court_votes_side_check" CHECK (
    vote_side IS NULL OR vote_side = ANY (ARRAY['for'::text, 'against'::text])
  ),
  CONSTRAINT "court_votes_stake_check" CHECK ("stake_amount" > 0),
  CONSTRAINT "court_votes_resolution_fkey" FOREIGN KEY ("resolution_id")
    REFERENCES "public"."bet_resolutions"("id") ON DELETE CASCADE,
  CONSTRAINT "court_votes_user_fkey" FOREIGN KEY ("user_id")
    REFERENCES "public"."profiles"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."court_votes" ENABLE ROW LEVEL SECURITY;

CREATE INDEX "idx_court_votes_resolution_id" ON "public"."court_votes" USING btree ("resolution_id");
CREATE INDEX "idx_court_votes_user_id" ON "public"."court_votes" USING btree ("user_id");

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- bet_resolutions: readable by anyone who can see the bet
CREATE POLICY "Resolutions readable by bet viewers"
  ON "public"."bet_resolutions"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bets b
      WHERE b.id = bet_resolutions.bet_id
      AND (
        b.visibility = 'public'
        OR b.creator_id = auth.uid()
        OR (b.visibility = 'friends' AND public.is_friend(b.creator_id, auth.uid()))
        OR b.visibility = 'private'
      )
    )
  );

-- Deny direct writes to bet_resolutions (only via stored procedures)
CREATE POLICY "Deny direct resolution writes"
  ON "public"."bet_resolutions"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "Deny direct resolution updates"
  ON "public"."bet_resolutions"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (false);

-- court_votes: users can only see their own votes, and aggregate results
CREATE POLICY "Users can see own votes"
  ON "public"."court_votes"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can see revealed votes on their bets"
  ON "public"."court_votes"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bet_resolutions br
      JOIN public.bets b ON b.id = br.bet_id
      WHERE br.id = court_votes.resolution_id
      AND br.status = 'completed'
      AND (
        b.visibility = 'public'
        OR b.creator_id = auth.uid()
        OR (b.visibility = 'friends' AND public.is_friend(b.creator_id, auth.uid()))
        OR b.visibility = 'private'
      )
    )
  );

-- Deny direct writes to court_votes
CREATE POLICY "Deny direct court vote writes"
  ON "public"."court_votes"
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "Deny direct court vote updates"
  ON "public"."court_votes"
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (false);

-- ============================================================================
-- STORED PROCEDURES
-- ============================================================================

SET check_function_bodies = off;

-- ============================================================================
-- propose_resolution()
-- Any bet participant can propose an outcome
-- Pays a small proposal fee (refundable if they win the court)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.propose_resolution(
  p_bet_id uuid,
  p_outcome text
)
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
  -- Validate outcome
  IF p_outcome NOT IN ('for', 'against') THEN
    RAISE EXCEPTION 'Invalid outcome. Must be "for" or "against"';
  END IF;

  -- Get bet
  SELECT * INTO v_bet FROM public.bets WHERE id = p_bet_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bet not found';
  END IF;

  -- Bet must be published and expired
  IF v_bet.status != 'published' THEN
    RAISE EXCEPTION 'Bet is not open for resolution';
  END IF;

  IF v_bet.end_time > NOW() THEN
    RAISE EXCEPTION 'Bet has not expired yet';
  END IF;

  -- Check if user is a participant (creator or has wagered)
  v_is_participant := (v_bet.creator_id = v_user_id) OR
    EXISTS (SELECT 1 FROM public.wagers WHERE bet_id = p_bet_id AND user_id = v_user_id);

  IF NOT v_is_participant THEN
    RAISE EXCEPTION 'Only bet participants can propose a resolution';
  END IF;

  -- Check if already resolved or in resolution
  IF EXISTS (SELECT 1 FROM public.bet_resolutions WHERE bet_id = p_bet_id AND status NOT IN ('expired', 'completed')) THEN
    RAISE EXCEPTION 'Bet already has an active resolution';
  END IF;

  -- Check user has enough points for proposal fee
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  IF v_profile.points < v_proposal_fee THEN
    RAISE EXCEPTION 'Insufficient points for proposal fee (need %)', v_proposal_fee;
  END IF;

  -- Create resolution record
  INSERT INTO public.bet_resolutions (
    bet_id, status, proposed_by, proposed_outcome, proposed_at, proposal_fee
  ) VALUES (
    p_bet_id, 'proposed', v_user_id, p_outcome, NOW(), v_proposal_fee
  ) RETURNING id INTO v_resolution_id;

  -- Deduct proposal fee
  UPDATE public.profiles SET points = points - v_proposal_fee WHERE id = v_user_id;
  INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by, reason)
  VALUES (v_user_id, 'resolution_proposal', -v_proposal_fee, p_bet_id, v_user_id, 'Proposal fee');

  -- Update bet status
  UPDATE public.bets SET status = 'in_resolution' WHERE id = p_bet_id;

  RETURN v_resolution_id;
END;
$function$
;

-- ============================================================================
-- challenge_resolution()
-- Any bet participant can challenge a proposed outcome
-- Triggers the court voting phase
-- ============================================================================
CREATE OR REPLACE FUNCTION public.challenge_resolution(
  p_bet_id uuid
)
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
  -- Get bet
  SELECT * INTO v_bet FROM public.bets WHERE id = p_bet_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bet not found';
  END IF;

  -- Get resolution
  SELECT * INTO v_resolution FROM public.bet_resolutions
    WHERE bet_id = p_bet_id AND status = 'proposed';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active proposal to challenge';
  END IF;

  -- Check if user is a participant
  v_is_participant := (v_bet.creator_id = v_user_id) OR
    EXISTS (SELECT 1 FROM public.wagers WHERE bet_id = p_bet_id AND user_id = v_user_id);

  IF NOT v_is_participant THEN
    RAISE EXCEPTION 'Only bet participants can challenge';
  END IF;

  -- Update resolution
  UPDATE public.bet_resolutions
  SET status = 'challenged', challenged_by = v_user_id, challenged_at = NOW()
  WHERE id = v_resolution.id;

  -- Notify proposer
  INSERT INTO public.notifications (user_id, type, from_user_id, bet_id)
  VALUES (v_resolution.proposed_by, 'bet_resolved', v_user_id, p_bet_id);
END;
$function$
;

-- ============================================================================
-- start_court_voting()
-- Activated after challenge. Opens voting phase.
-- All participants must commit their votes.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.start_court_voting(
  p_bet_id uuid
)
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
  -- Get bet
  SELECT * INTO v_bet FROM public.bets WHERE id = p_bet_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bet not found';
  END IF;

  -- Only creator or challenger can start voting
  SELECT * INTO v_resolution FROM public.bet_resolutions
    WHERE bet_id = p_bet_id AND status = 'challenged';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No challenged resolution found';
  END IF;

  IF v_bet.creator_id != v_user_id AND v_resolution.challenged_by != v_user_id THEN
    RAISE EXCEPTION 'Only creator or challenger can start voting';
  END IF;

  -- Update resolution status
  UPDATE public.bet_resolutions
  SET status = 'voting'
  WHERE id = v_resolution.id
  RETURNING id INTO v_resolution_id;

  RETURN v_resolution_id;
END;
$function$
;

-- ============================================================================
-- submit_vote_commit()
-- First phase of commit-reveal: submit hash of vote
-- vote_commit = sha256(vote_side || user_id || secret_salt)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.submit_vote_commit(
  p_resolution_id uuid,
  p_commit_hash text
)
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
  -- Get resolution
  SELECT * INTO v_resolution FROM public.bet_resolutions WHERE id = p_resolution_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resolution not found';
  END IF;

  -- Resolution must be in voting phase
  IF v_resolution.status != 'voting' THEN
    RAISE EXCEPTION 'Resolution is not in voting phase';
  END IF;

  -- Get bet
  SELECT * INTO v_bet FROM public.bets WHERE id = v_resolution.bet_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bet not found';
  END IF;

  -- Check if user is a participant
  v_is_participant := (v_bet.creator_id = v_user_id) OR
    EXISTS (SELECT 1 FROM public.wagers WHERE bet_id = v_bet.id AND user_id = v_user_id);

  IF NOT v_is_participant THEN
    RAISE EXCEPTION 'Only bet participants can vote';
  END IF;

  -- Check if already committed
  SELECT * INTO v_existing_commit FROM public.court_votes
    WHERE resolution_id = p_resolution_id AND user_id = v_user_id;
  IF FOUND THEN
    IF v_existing_commit.revealed THEN
      RAISE EXCEPTION 'Vote already revealed';
    END IF;
    RAISE EXCEPTION 'Vote already committed';
  END IF;

  -- Check user has enough points for juror stake
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  IF v_profile.points < v_juror_stake THEN
    RAISE EXCEPTION 'Insufficient points for juror stake (need %)', v_juror_stake;
  END IF;

  -- Deduct stake
  UPDATE public.profiles SET points = points - v_juror_stake WHERE id = v_user_id;
  INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by, reason)
  VALUES (v_user_id, 'court_stake', -v_juror_stake, v_bet.id, v_user_id, 'Court vote stake');

  -- Insert commit
  INSERT INTO public.court_votes (resolution_id, user_id, commit_hash, stake_amount)
  VALUES (p_resolution_id, v_user_id, p_commit_hash, v_juror_stake);
END;
$function$
;

-- ============================================================================
-- submit_vote_reveal()
-- Second phase of commit-reveal: reveal actual vote
-- ============================================================================
CREATE OR REPLACE FUNCTION public.submit_vote_reveal(
  p_resolution_id uuid,
  p_vote_side text
)
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
  -- Get vote
  SELECT * INTO v_vote FROM public.court_votes
    WHERE resolution_id = p_resolution_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No committed vote found';
  END IF;

  IF v_vote.revealed THEN
    RAISE EXCEPTION 'Vote already revealed';
  END IF;

  -- Get resolution
  SELECT * INTO v_resolution FROM public.bet_resolutions WHERE id = p_resolution_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resolution not found';
  END IF;

  -- Validate side
  IF p_vote_side NOT IN ('for', 'against') THEN
    RAISE EXCEPTION 'Invalid vote side';
  END IF;

  -- Update vote
  UPDATE public.court_votes
  SET vote_side = p_vote_side, revealed = true, revealed_at = NOW()
  WHERE id = v_vote.id;
END;
$function$
;

-- ============================================================================
-- resolve_court()
-- Tally votes, distribute stakes, finalize bet
-- Called after all votes are revealed (or timeout)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.resolve_court(
  p_bet_id uuid
)
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
  -- Get bet
  SELECT * INTO v_bet FROM public.bets WHERE id = p_bet_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bet not found';
  END IF;

  -- Get resolution
  SELECT * INTO v_resolution FROM public.bet_resolutions
    WHERE bet_id = p_bet_id AND status IN ('voting', 'challenged');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active resolution found';
  END IF;

  -- Only creator or challenger can resolve
  IF v_bet.creator_id != v_user_id AND v_resolution.challenged_by != v_user_id THEN
    RAISE EXCEPTION 'Only creator or challenger can resolve court';
  END IF;

  -- Count votes (only revealed votes)
  SELECT COUNT(*) INTO v_total_voters FROM public.court_votes
    WHERE resolution_id = v_resolution.id AND revealed = true;

  SELECT COUNT(*) INTO v_for_count FROM public.court_votes
    WHERE resolution_id = v_resolution.id AND revealed = true AND vote_side = 'for';

  SELECT COUNT(*) INTO v_against_count FROM public.court_votes
    WHERE resolution_id = v_resolution.id AND revealed = true AND vote_side = 'against';

  -- Calculate total stakes per side
  SELECT COALESCE(SUM(stake_amount), 0) INTO v_for_stakes_total FROM public.court_votes
    WHERE resolution_id = v_resolution.id AND revealed = true AND vote_side = 'for';

  SELECT COALESCE(SUM(stake_amount), 0) INTO v_against_stakes_total FROM public.court_votes
    WHERE resolution_id = v_resolution.id AND revealed = true AND vote_side = 'against';

  -- Determine court winner
  IF v_total_voters = 0 THEN
    -- No one voted - refund all wagers
    v_court_winner := 'refund';
  ELSIF v_for_count = v_against_count THEN
    -- Tie - refund all wagers
    v_court_winner := 'refund';
  ELSIF v_for_count > v_against_count THEN
    v_court_winner := 'for';
  ELSE
    v_court_winner := 'against';
  END IF;

  -- Update resolution
  UPDATE public.bet_resolutions
  SET status = 'completed', court_winner = v_court_winner, resolved_at = NOW()
  WHERE id = v_resolution.id;

  -- Distribute juror stakes
  IF v_court_winner = 'refund' THEN
    -- Refund all juror stakes
    FOR v_voter IN SELECT * FROM public.court_votes WHERE resolution_id = v_resolution.id LOOP
      UPDATE public.profiles SET points = points + v_voter.stake_amount WHERE id = v_voter.user_id;
      INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by, reason)
      VALUES (v_voter.user_id, 'court_refund', v_voter.stake_amount, v_bet.id, v_user_id, 'Court vote stake refunded');
    END LOOP;

    -- Refund all wagers
    FOR v_wager IN SELECT * FROM public.wagers WHERE bet_id = p_bet_id LOOP
      UPDATE public.profiles SET points = points + v_wager.amount WHERE id = v_wager.user_id;
      INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by, reason)
      VALUES (v_wager.user_id, 'wager_refund', v_wager.amount, p_bet_id, v_user_id, 'Bet refunded - court tie');
    END LOOP;

    -- Refund proposal fee
    IF v_resolution.proposal_fee > 0 AND v_resolution.proposed_by IS NOT NULL THEN
      UPDATE public.profiles SET points = points + v_resolution.proposal_fee WHERE id = v_resolution.proposed_by;
    END IF;

    -- Update bet status
    UPDATE public.bets SET status = 'refunded', resolved_at = NOW() WHERE id = p_bet_id;

  ELSE
    -- Court has a winner
    -- Winning jurors get their stake back + share of losing jurors' stakes
    FOR v_voter IN SELECT * FROM public.court_votes WHERE resolution_id = v_resolution.id AND revealed = true LOOP
      IF v_voter.vote_side = v_court_winner THEN
        -- Winner: get stake back + proportional share of losing stakes
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
          -- No losing jurors, just refund stake
          UPDATE public.profiles SET points = points + v_voter.stake_amount WHERE id = v_voter.user_id;
          INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by, reason)
          VALUES (v_voter.user_id, 'court_refund', v_voter.stake_amount, v_bet.id, v_user_id, 'Court vote stake refunded');
        END IF;
      ELSE
        -- Loser: stake is already deducted, no refund
        INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by, reason)
        VALUES (v_voter.user_id, 'court_loss', -v_voter.stake_amount, v_bet.id, v_user_id, 'Court vote lost');
      END IF;
    END LOOP;

    -- Refund proposal fee to proposer (they were on the winning side)
    SELECT * INTO v_proposer FROM public.profiles WHERE id = v_resolution.proposed_by;
    IF v_resolution.proposed_outcome = v_court_winner AND v_resolution.proposal_fee > 0 THEN
      UPDATE public.profiles SET points = points + v_resolution.proposal_fee WHERE id = v_resolution.proposed_by;
      INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by, reason)
      VALUES (v_resolution.proposed_by, 'court_proposal_refund', v_resolution.proposal_fee, v_bet.id, v_user_id, 'Proposal fee refunded');
    END IF;

    -- Distribute bet winnings (same as original resolve_bet logic)
    v_creator_stake := v_bet.stake;
    SELECT COALESCE(SUM(amount), 0) INTO v_winner_total FROM public.wagers
      WHERE bet_id = p_bet_id AND side = v_court_winner;

    FOR v_wager IN SELECT * FROM public.wagers WHERE bet_id = p_bet_id AND side = v_court_winner LOOP
      v_winnings := v_wager.amount + (CASE WHEN v_winner_total > 0 THEN (v_wager.amount::NUMERIC / v_winner_total * v_creator_stake) ELSE 0 END);
      UPDATE public.profiles SET points = points + FLOOR(v_winnings) WHERE id = v_wager.user_id;
      INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by)
      VALUES (v_wager.user_id, 'win', FLOOR(v_winnings), p_bet_id, v_user_id);
      INSERT INTO public.notifications (user_id, type, from_user_id, bet_id)
      VALUES (v_wager.user_id, 'bet_resolved', v_user_id, p_bet_id);
    END LOOP;

    -- Losers
    FOR v_wager IN SELECT * FROM public.wagers WHERE bet_id = p_bet_id AND side != v_court_winner LOOP
      INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by)
      VALUES (v_wager.user_id, 'loss', -v_wager.amount, p_bet_id, v_user_id);
      INSERT INTO public.notifications (user_id, type, from_user_id, bet_id)
      VALUES (v_wager.user_id, 'bet_resolved', v_user_id, p_bet_id);
    END LOOP;

    -- Update bet status
    UPDATE public.bets SET status = 'resolved', winner = v_court_winner, resolved_at = NOW() WHERE id = p_bet_id;
  END IF;
END;
$function$
;

-- ============================================================================
-- expire_resolution()
-- Called when resolution window expires without a proposal
-- Refunds all wagers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.expire_resolution(
  p_bet_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bet RECORD;
  v_wager RECORD;
BEGIN
  -- Lock the bet row to prevent concurrent refunds
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

  -- Update bet status FIRST to prevent double refunds
  UPDATE public.bets SET status = 'refunded', resolved_at = NOW() WHERE id = p_bet_id;

  -- Then refund all wagers
  FOR v_wager IN SELECT * FROM public.wagers WHERE bet_id = p_bet_id LOOP
    UPDATE public.profiles SET points = points + v_wager.amount WHERE id = v_wager.user_id;
    INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by, reason)
    VALUES (v_wager.user_id, 'wager_refund', v_wager.amount, p_bet_id, v_bet.creator_id, 'Bet expired - no resolution proposed');
  END LOOP;
END;
$function$
;

-- ============================================================================
-- get_resolution_info()
-- Returns resolution info for a bet (frontend helper)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_resolution_info(
  p_bet_id uuid
)
RETURNS TABLE(
  resolution_id uuid,
  status text,
  proposed_by uuid,
  proposed_by_username text,
  proposed_outcome text,
  proposed_at timestamp with time zone,
  challenged_by uuid,
  challenged_by_username text,
  challenged_at timestamp with time zone,
  court_winner text,
  resolved_at timestamp with time zone,
  proposal_fee integer,
  total_voters integer,
  for_votes integer,
  against_votes integer,
  user_has_committed boolean,
  user_has_revealed boolean,
  user_vote_side text
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
  SELECT * INTO v_resolution FROM public.bet_resolutions
    WHERE bet_id = p_bet_id
    ORDER BY created_at DESC
    LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      NULL::uuid, NULL::text, NULL::uuid, NULL::text, NULL::text,
      NULL::timestamptz, NULL::uuid, NULL::text, NULL::timestamptz,
      NULL::text, NULL::timestamptz, 0, 0, 0, 0, false, false, NULL::text;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_total FROM public.court_votes
    WHERE resolution_id = v_resolution.id AND revealed = true;

  SELECT COUNT(*) INTO v_for_count FROM public.court_votes
    WHERE resolution_id = v_resolution.id AND revealed = true AND vote_side = 'for';

  SELECT COUNT(*) INTO v_against_count FROM public.court_votes
    WHERE resolution_id = v_resolution.id AND revealed = true AND vote_side = 'against';

  SELECT * INTO v_user_commit FROM public.court_votes
    WHERE resolution_id = v_resolution.id AND user_id = v_user_id;

  RETURN QUERY SELECT
    v_resolution.id,
    v_resolution.status,
    v_resolution.proposed_by,
    (SELECT username FROM public.profiles WHERE id = v_resolution.proposed_by),
    v_resolution.proposed_outcome,
    v_resolution.proposed_at,
    v_resolution.challenged_by,
    (SELECT username FROM public.profiles WHERE id = v_resolution.challenged_by),
    v_resolution.challenged_at,
    v_resolution.court_winner,
    v_resolution.resolved_at,
    v_resolution.proposal_fee,
    v_total,
    v_for_count,
    v_against_count,
    (v_user_commit IS NOT NULL),
    (v_user_commit IS NOT NULL AND v_user_commit.revealed = true),
    v_user_commit.vote_side;
END;
$function$
;

-- ============================================================================
-- get_court_participants()
-- Returns all participants eligible to vote on a court
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_court_participants(
  p_bet_id uuid
)
RETURNS TABLE(
  user_id uuid,
  username text,
  side text,
  amount integer,
  has_committed boolean,
  has_revealed boolean,
  vote_side text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_resolution_id UUID;
BEGIN
  SELECT id INTO v_resolution_id FROM public.bet_resolutions
    WHERE bet_id = p_bet_id
    ORDER BY created_at DESC
    LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Creator
  RETURN QUERY
  SELECT
    b.creator_id,
    p.username,
    'creator'::text,
    0,
    (cv.id IS NOT NULL),
    (cv.revealed = true),
    cv.vote_side
  FROM public.bets b
  JOIN public.profiles p ON p.id = b.creator_id
  LEFT JOIN public.court_votes cv ON cv.resolution_id = v_resolution_id AND cv.user_id = b.creator_id
  WHERE b.id = p_bet_id;

  -- Wager participants
  RETURN QUERY
  SELECT
    w.user_id,
    p.username,
    w.side,
    w.amount,
    (cv.id IS NOT NULL),
    (cv.revealed = true),
    cv.vote_side
  FROM public.wagers w
  JOIN public.profiles p ON p.id = w.user_id
  LEFT JOIN public.court_votes cv ON cv.resolution_id = v_resolution_id AND cv.user_id = w.user_id
  WHERE w.bet_id = p_bet_id;
END;
$function$
;

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT SELECT ON TABLE "public"."bet_resolutions" TO "anon";
GRANT SELECT ON TABLE "public"."bet_resolutions" TO "authenticated";
GRANT ALL ON TABLE "public"."bet_resolutions" TO "service_role";

GRANT SELECT ON TABLE "public"."court_votes" TO "anon";
GRANT SELECT ON TABLE "public"."court_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."court_votes" TO "service_role";

-- Add new notification type
ALTER TABLE "public"."notifications" DROP CONSTRAINT IF EXISTS "notifications_type_check";
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_type_check" CHECK (
  type = ANY (ARRAY[
    'friend_request'::text,
    'friend_accepted'::text,
    'friend_declined'::text,
    'friend_bet'::text,
    'bet_resolved'::text,
    'resolution_proposed'::text,
    'resolution_challenged'::text,
    'court_voting_open'::text
  ])
);
