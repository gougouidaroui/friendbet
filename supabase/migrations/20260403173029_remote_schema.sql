drop extension if exists "pg_net";

create schema if not exists "internal";


  create table "internal"."transactions" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "type" text not null,
    "amount" integer not null,
    "bet_id" uuid,
    "streak" integer,
    "reason" text,
    "created_by" uuid,
    "created_at" timestamp with time zone default now()
      );


alter table "internal"."transactions" enable row level security;


  create table "public"."bets" (
    "id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "description" text,
    "duration" integer not null,
    "stake" integer default 0,
    "creator_id" uuid not null,
    "created_at" timestamp with time zone default now(),
    "end_time" timestamp with time zone not null,
    "status" text not null default 'draft'::text,
    "winner" text,
    "resolved_at" timestamp with time zone,
    "fee_paid" integer default 0,
    "visibility" text default 'public'::text
      );


alter table "public"."bets" enable row level security;


  create table "public"."friendships" (
    "id" uuid not null default gen_random_uuid(),
    "requester_id" uuid not null,
    "addressee_id" uuid not null,
    "status" text not null default 'pending'::text,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."friendships" enable row level security;


  create table "public"."notifications" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "type" text not null,
    "from_user_id" uuid,
    "bet_id" uuid,
    "read" boolean default false,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."notifications" enable row level security;


  create table "public"."penguin_calendar" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "login_date" date not null,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."penguin_calendar" enable row level security;


  create table "public"."profiles" (
    "id" uuid not null,
    "username" text not null,
    "points" integer default 5000,
    "is_admin" boolean default false,
    "last_login" date,
    "login_streak" integer default 0,
    "created_at" timestamp with time zone default now(),
    "rescues_remaining" integer default 5,
    "rescues_reset_date" date default ((date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone) + '1 mon'::interval))::date,
    "penguin_stage" integer default 0,
    "win_streak" integer default 0,
    "best_win_streak" integer default 0,
    "trophy_level" integer default 0,
    "streak_in_danger" boolean default false
      );


alter table "public"."profiles" enable row level security;


  create table "public"."wagers" (
    "id" uuid not null default gen_random_uuid(),
    "bet_id" uuid not null,
    "user_id" uuid not null,
    "side" text not null,
    "amount" integer not null,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."wagers" enable row level security;

CREATE UNIQUE INDEX transactions_pkey ON internal.transactions USING btree (id);

CREATE UNIQUE INDEX bets_pkey ON public.bets USING btree (id);

CREATE UNIQUE INDEX friendships_pkey ON public.friendships USING btree (id);

CREATE UNIQUE INDEX friendships_requester_id_addressee_id_key ON public.friendships USING btree (requester_id, addressee_id);

CREATE INDEX idx_bets_creator ON public.bets USING btree (creator_id);

CREATE INDEX idx_friendships_users ON public.friendships USING btree (requester_id, addressee_id);

CREATE INDEX idx_wagers_bet_id ON public.wagers USING btree (bet_id);

CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id);

CREATE UNIQUE INDEX penguin_calendar_pkey ON public.penguin_calendar USING btree (id);

CREATE UNIQUE INDEX penguin_calendar_user_id_login_date_key ON public.penguin_calendar USING btree (user_id, login_date);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE UNIQUE INDEX profiles_username_key ON public.profiles USING btree (username);

CREATE UNIQUE INDEX wagers_bet_id_user_id_key ON public.wagers USING btree (bet_id, user_id);

CREATE UNIQUE INDEX wagers_pkey ON public.wagers USING btree (id);

alter table "internal"."transactions" add constraint "transactions_pkey" PRIMARY KEY using index "transactions_pkey";

alter table "public"."bets" add constraint "bets_pkey" PRIMARY KEY using index "bets_pkey";

alter table "public"."friendships" add constraint "friendships_pkey" PRIMARY KEY using index "friendships_pkey";

alter table "public"."notifications" add constraint "notifications_pkey" PRIMARY KEY using index "notifications_pkey";

alter table "public"."penguin_calendar" add constraint "penguin_calendar_pkey" PRIMARY KEY using index "penguin_calendar_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."wagers" add constraint "wagers_pkey" PRIMARY KEY using index "wagers_pkey";

alter table "internal"."transactions" add constraint "transactions_bet_id_fkey" FOREIGN KEY (bet_id) REFERENCES public.bets(id) ON DELETE SET NULL not valid;

alter table "internal"."transactions" validate constraint "transactions_bet_id_fkey";

alter table "internal"."transactions" add constraint "transactions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "internal"."transactions" validate constraint "transactions_created_by_fkey";

alter table "internal"."transactions" add constraint "transactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "internal"."transactions" validate constraint "transactions_user_id_fkey";

alter table "public"."bets" add constraint "bets_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."bets" validate constraint "bets_creator_id_fkey";

alter table "public"."bets" add constraint "bets_duration_check" CHECK ((duration > 0)) not valid;

alter table "public"."bets" validate constraint "bets_duration_check";

alter table "public"."bets" add constraint "bets_stake_check" CHECK ((stake >= 0)) not valid;

alter table "public"."bets" validate constraint "bets_stake_check";

alter table "public"."bets" add constraint "bets_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'resolved'::text]))) not valid;

alter table "public"."bets" validate constraint "bets_status_check";

alter table "public"."bets" add constraint "bets_visibility_check" CHECK ((visibility = ANY (ARRAY['public'::text, 'friends'::text, 'private'::text]))) not valid;

alter table "public"."bets" validate constraint "bets_visibility_check";

alter table "public"."bets" add constraint "bets_winner_check" CHECK ((winner = ANY (ARRAY['for'::text, 'against'::text]))) not valid;

alter table "public"."bets" validate constraint "bets_winner_check";

alter table "public"."friendships" add constraint "friendships_addressee_id_fkey" FOREIGN KEY (addressee_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."friendships" validate constraint "friendships_addressee_id_fkey";

alter table "public"."friendships" add constraint "friendships_check" CHECK ((requester_id <> addressee_id)) not valid;

alter table "public"."friendships" validate constraint "friendships_check";

alter table "public"."friendships" add constraint "friendships_requester_id_addressee_id_key" UNIQUE using index "friendships_requester_id_addressee_id_key";

alter table "public"."friendships" add constraint "friendships_requester_id_fkey" FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."friendships" validate constraint "friendships_requester_id_fkey";

alter table "public"."friendships" add constraint "friendships_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text]))) not valid;

alter table "public"."friendships" validate constraint "friendships_status_check";

alter table "public"."notifications" add constraint "notifications_bet_id_fkey" FOREIGN KEY (bet_id) REFERENCES public.bets(id) ON DELETE SET NULL not valid;

alter table "public"."notifications" validate constraint "notifications_bet_id_fkey";

alter table "public"."notifications" add constraint "notifications_from_user_id_fkey" FOREIGN KEY (from_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."notifications" validate constraint "notifications_from_user_id_fkey";

alter table "public"."notifications" add constraint "notifications_type_check" CHECK ((type = ANY (ARRAY['friend_request'::text, 'friend_accepted'::text, 'friend_declined'::text, 'friend_bet'::text, 'bet_resolved'::text]))) not valid;

alter table "public"."notifications" validate constraint "notifications_type_check";

alter table "public"."notifications" add constraint "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."notifications" validate constraint "notifications_user_id_fkey";

alter table "public"."penguin_calendar" add constraint "penguin_calendar_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."penguin_calendar" validate constraint "penguin_calendar_user_id_fkey";

alter table "public"."penguin_calendar" add constraint "penguin_calendar_user_id_login_date_key" UNIQUE using index "penguin_calendar_user_id_login_date_key";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."profiles" add constraint "profiles_points_check" CHECK ((points >= 0)) not valid;

alter table "public"."profiles" validate constraint "profiles_points_check";

alter table "public"."profiles" add constraint "profiles_username_key" UNIQUE using index "profiles_username_key";

alter table "public"."wagers" add constraint "wagers_amount_check" CHECK ((amount > 0)) not valid;

alter table "public"."wagers" validate constraint "wagers_amount_check";

alter table "public"."wagers" add constraint "wagers_bet_id_fkey" FOREIGN KEY (bet_id) REFERENCES public.bets(id) ON DELETE CASCADE not valid;

alter table "public"."wagers" validate constraint "wagers_bet_id_fkey";

alter table "public"."wagers" add constraint "wagers_bet_id_user_id_key" UNIQUE using index "wagers_bet_id_user_id_key";

alter table "public"."wagers" add constraint "wagers_side_check" CHECK ((side = ANY (ARRAY['for'::text, 'against'::text]))) not valid;

alter table "public"."wagers" validate constraint "wagers_side_check";

alter table "public"."wagers" add constraint "wagers_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."wagers" validate constraint "wagers_user_id_fkey";

set check_function_bodies = off;

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

CREATE OR REPLACE FUNCTION public.calculate_penguin_stage(streak_days integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION public.create_bet(p_title text, p_description text, p_duration integer, p_stake integer, p_visibility text DEFAULT 'public'::text, p_publish boolean DEFAULT false)
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
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
  
  v_fee := 10 + p_duration;
  
  IF p_publish AND v_profile.points < v_fee THEN
    RAISE EXCEPTION 'Insufficient points. Need %', v_fee;
  END IF;
  
  INSERT INTO public.bets (
    title, description, duration, stake, creator_id, 
    end_time, status, fee_paid, visibility
  ) VALUES (
    p_title, p_description, p_duration, p_stake, v_user_id,
    NOW() + (p_duration || ' hours')::INTERVAL,
    CASE WHEN p_publish THEN 'published' ELSE 'draft' END,
    CASE WHEN p_publish THEN v_fee ELSE 0 END,
    p_visibility
  ) RETURNING id INTO v_bet_id;
  
  IF p_publish THEN
    UPDATE public.profiles SET points = points - v_fee WHERE id = v_user_id;
    INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by)
    VALUES (v_user_id, 'bet_created', -v_fee, v_bet_id, v_user_id);
  END IF;
  
  RETURN v_bet_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_penguin_calendar()
 RETURNS TABLE(login_date date)
 LANGUAGE plpgsql
 SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, username, points)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)), 5000);
  INSERT INTO internal.transactions (user_id, type, amount, created_by) VALUES (NEW.id, 'initial', 5000, NEW.id);
  RETURN NEW;
END; $function$
;

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
  IF p_side NOT IN ('for', 'against') THEN
    RAISE EXCEPTION 'Invalid side';
  END IF;
  
  SELECT * INTO v_bet FROM public.bets WHERE id = p_bet_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bet not found';
  END IF;
  
  IF v_bet.status != 'published' THEN
    RAISE EXCEPTION 'Bet is not open for wagers';
  END IF;
  
  IF v_bet.end_time < NOW() THEN
    RAISE EXCEPTION 'Bet has expired';
  END IF;
  
  IF v_bet.creator_id = v_user_id THEN
    RAISE EXCEPTION 'Cannot wager on your own bet';
  END IF;
  
  IF EXISTS (SELECT 1 FROM public.wagers WHERE bet_id = p_bet_id AND user_id = v_user_id) THEN
    RAISE EXCEPTION 'Already wagered on this bet';
  END IF;
  
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  
  IF p_amount > v_profile.points THEN
    RAISE EXCEPTION 'Insufficient points';
  END IF;
  
  INSERT INTO public.wagers (bet_id, user_id, side, amount)
  VALUES (p_bet_id, v_user_id, p_side, p_amount);
  
  UPDATE public.profiles SET points = points - p_amount WHERE id = v_user_id;
  
  INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by)
  VALUES (v_user_id, 'wager', -p_amount, p_bet_id, v_user_id);
END;
$function$
;

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

CREATE OR REPLACE FUNCTION public.remove_friend(p_friendship_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.friendships 
    WHERE id = p_friendship_id 
    AND (requester_id = v_user_id OR addressee_id = v_user_id)
  ) THEN
    RAISE EXCEPTION 'Friendship not found or unauthorized';
  END IF;
  
  DELETE FROM public.friendships WHERE id = p_friendship_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reset_monthly_rescues()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.profiles
  SET rescues_remaining = 5,
      rescues_reset_date = (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::DATE
  WHERE rescues_reset_date <= CURRENT_DATE;
END;
$function$
;

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
  IF p_winner NOT IN ('for', 'against') THEN
    RAISE EXCEPTION 'Invalid winner';
  END IF;
  
  SELECT * INTO v_bet FROM public.bets WHERE id = p_bet_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bet not found'; END IF;
  
  IF v_bet.creator_id != v_user_id THEN
    RAISE EXCEPTION 'Only the creator can resolve the bet';
  END IF;
  
  IF v_bet.status != 'published' THEN
    RAISE EXCEPTION 'Bet cannot be resolved';
  END IF;

  -- Re-implemented: Early resolution only allowed if no stake is at risk
  IF v_bet.end_time > NOW() AND v_bet.stake > 0 THEN
    RAISE EXCEPTION 'Bet has not expired yet';
  END IF;
  
  v_creator_stake := v_bet.stake;
  SELECT COALESCE(SUM(amount), 0) INTO v_winner_total FROM public.wagers WHERE bet_id = p_bet_id AND side = p_winner;
  
  -- Winners
  FOR v_wager IN SELECT * FROM public.wagers WHERE bet_id = p_bet_id AND side = p_winner LOOP
    v_winnings := v_wager.amount + (CASE WHEN v_winner_total > 0 THEN (v_wager.amount::NUMERIC / v_winner_total * v_creator_stake) ELSE 0 END);
    UPDATE public.profiles SET points = points + FLOOR(v_winnings) WHERE id = v_wager.user_id;
    INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by) VALUES (v_wager.user_id, 'win', FLOOR(v_winnings), p_bet_id, v_user_id);
    INSERT INTO public.notifications (user_id, type, from_user_id, bet_id) VALUES (v_wager.user_id, 'bet_resolved', v_user_id, p_bet_id);
  END LOOP;
  
  -- Losers
  FOR v_wager IN SELECT * FROM public.wagers WHERE bet_id = p_bet_id AND side != p_winner LOOP
    INSERT INTO internal.transactions (user_id, type, amount, bet_id, created_by) VALUES (v_wager.user_id, 'loss', -v_wager.amount, p_bet_id, v_user_id);
    INSERT INTO public.notifications (user_id, type, from_user_id, bet_id) VALUES (v_wager.user_id, 'bet_resolved', v_user_id, p_bet_id);
  END LOOP;
  
  UPDATE public.bets SET status = 'resolved', winner = p_winner, resolved_at = NOW() WHERE id = p_bet_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.send_friend_request(p_addressee_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF p_addressee_id = v_user_id THEN
    RAISE EXCEPTION 'Cannot friend yourself';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM public.friendships 
    WHERE (requester_id = v_user_id AND addressee_id = p_addressee_id)
       OR (requester_id = p_addressee_id AND addressee_id = v_user_id)
  ) THEN
    RAISE EXCEPTION 'Friendship already exists or is pending';
  END IF;
  
  INSERT INTO public.friendships (requester_id, addressee_id)
  VALUES (v_user_id, p_addressee_id);
  
  INSERT INTO public.notifications (user_id, type, from_user_id)
  VALUES (p_addressee_id, 'friend_request', v_user_id);
END;
$function$
;

create or replace view "public"."transaction_history" as  SELECT id,
    user_id,
    type,
    amount,
    bet_id,
    created_at
   FROM internal.transactions;


CREATE OR REPLACE FUNCTION public.update_win_streak(p_won boolean)
 RETURNS TABLE(new_win_streak integer, best_win_streak integer, new_trophy_level integer, points_earned integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION public.use_rescue()
 RETURNS TABLE(success boolean, new_streak integer, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
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

grant delete on table "public"."bets" to "anon";

grant insert on table "public"."bets" to "anon";

grant references on table "public"."bets" to "anon";

grant select on table "public"."bets" to "anon";

grant trigger on table "public"."bets" to "anon";

grant truncate on table "public"."bets" to "anon";

grant update on table "public"."bets" to "anon";

grant delete on table "public"."bets" to "authenticated";

grant insert on table "public"."bets" to "authenticated";

grant references on table "public"."bets" to "authenticated";

grant select on table "public"."bets" to "authenticated";

grant trigger on table "public"."bets" to "authenticated";

grant truncate on table "public"."bets" to "authenticated";

grant update on table "public"."bets" to "authenticated";

grant delete on table "public"."bets" to "service_role";

grant insert on table "public"."bets" to "service_role";

grant references on table "public"."bets" to "service_role";

grant select on table "public"."bets" to "service_role";

grant trigger on table "public"."bets" to "service_role";

grant truncate on table "public"."bets" to "service_role";

grant update on table "public"."bets" to "service_role";

grant delete on table "public"."friendships" to "anon";

grant insert on table "public"."friendships" to "anon";

grant references on table "public"."friendships" to "anon";

grant select on table "public"."friendships" to "anon";

grant trigger on table "public"."friendships" to "anon";

grant truncate on table "public"."friendships" to "anon";

grant update on table "public"."friendships" to "anon";

grant delete on table "public"."friendships" to "authenticated";

grant insert on table "public"."friendships" to "authenticated";

grant references on table "public"."friendships" to "authenticated";

grant select on table "public"."friendships" to "authenticated";

grant trigger on table "public"."friendships" to "authenticated";

grant truncate on table "public"."friendships" to "authenticated";

grant update on table "public"."friendships" to "authenticated";

grant delete on table "public"."friendships" to "service_role";

grant insert on table "public"."friendships" to "service_role";

grant references on table "public"."friendships" to "service_role";

grant select on table "public"."friendships" to "service_role";

grant trigger on table "public"."friendships" to "service_role";

grant truncate on table "public"."friendships" to "service_role";

grant update on table "public"."friendships" to "service_role";

grant delete on table "public"."notifications" to "anon";

grant insert on table "public"."notifications" to "anon";

grant references on table "public"."notifications" to "anon";

grant select on table "public"."notifications" to "anon";

grant trigger on table "public"."notifications" to "anon";

grant truncate on table "public"."notifications" to "anon";

grant update on table "public"."notifications" to "anon";

grant delete on table "public"."notifications" to "authenticated";

grant insert on table "public"."notifications" to "authenticated";

grant references on table "public"."notifications" to "authenticated";

grant select on table "public"."notifications" to "authenticated";

grant trigger on table "public"."notifications" to "authenticated";

grant truncate on table "public"."notifications" to "authenticated";

grant update on table "public"."notifications" to "authenticated";

grant delete on table "public"."notifications" to "service_role";

grant insert on table "public"."notifications" to "service_role";

grant references on table "public"."notifications" to "service_role";

grant select on table "public"."notifications" to "service_role";

grant trigger on table "public"."notifications" to "service_role";

grant truncate on table "public"."notifications" to "service_role";

grant update on table "public"."notifications" to "service_role";

grant delete on table "public"."penguin_calendar" to "anon";

grant insert on table "public"."penguin_calendar" to "anon";

grant references on table "public"."penguin_calendar" to "anon";

grant select on table "public"."penguin_calendar" to "anon";

grant trigger on table "public"."penguin_calendar" to "anon";

grant truncate on table "public"."penguin_calendar" to "anon";

grant update on table "public"."penguin_calendar" to "anon";

grant delete on table "public"."penguin_calendar" to "authenticated";

grant insert on table "public"."penguin_calendar" to "authenticated";

grant references on table "public"."penguin_calendar" to "authenticated";

grant select on table "public"."penguin_calendar" to "authenticated";

grant trigger on table "public"."penguin_calendar" to "authenticated";

grant truncate on table "public"."penguin_calendar" to "authenticated";

grant update on table "public"."penguin_calendar" to "authenticated";

grant delete on table "public"."penguin_calendar" to "service_role";

grant insert on table "public"."penguin_calendar" to "service_role";

grant references on table "public"."penguin_calendar" to "service_role";

grant select on table "public"."penguin_calendar" to "service_role";

grant trigger on table "public"."penguin_calendar" to "service_role";

grant truncate on table "public"."penguin_calendar" to "service_role";

grant update on table "public"."penguin_calendar" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."wagers" to "anon";

grant insert on table "public"."wagers" to "anon";

grant references on table "public"."wagers" to "anon";

grant select on table "public"."wagers" to "anon";

grant trigger on table "public"."wagers" to "anon";

grant truncate on table "public"."wagers" to "anon";

grant update on table "public"."wagers" to "anon";

grant delete on table "public"."wagers" to "authenticated";

grant insert on table "public"."wagers" to "authenticated";

grant references on table "public"."wagers" to "authenticated";

grant select on table "public"."wagers" to "authenticated";

grant trigger on table "public"."wagers" to "authenticated";

grant truncate on table "public"."wagers" to "authenticated";

grant update on table "public"."wagers" to "authenticated";

grant delete on table "public"."wagers" to "service_role";

grant insert on table "public"."wagers" to "service_role";

grant references on table "public"."wagers" to "service_role";

grant select on table "public"."wagers" to "service_role";

grant trigger on table "public"."wagers" to "service_role";

grant truncate on table "public"."wagers" to "service_role";

grant update on table "public"."wagers" to "service_role";


  create policy "Bets access"
  on "public"."bets"
  as permissive
  for select
  to authenticated
using (((visibility = 'public'::text) OR (creator_id = auth.uid()) OR ((visibility = 'friends'::text) AND public.is_friend(creator_id, auth.uid())) OR (visibility = 'private'::text)));



  create policy "Deny direct bet writes"
  on "public"."bets"
  as permissive
  for insert
  to authenticated
with check (false);



  create policy "Friendship access"
  on "public"."friendships"
  as permissive
  for select
  to authenticated
using (((requester_id = auth.uid()) OR (addressee_id = auth.uid())));



  create policy "Notification access"
  on "public"."notifications"
  as permissive
  for select
  to authenticated
using ((user_id = auth.uid()));



  create policy "System can insert calendar entries"
  on "public"."penguin_calendar"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can view own calendar"
  on "public"."penguin_calendar"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Deny direct updates"
  on "public"."profiles"
  as permissive
  for update
  to authenticated
using (false);



  create policy "Profiles readable"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Deny direct wager writes"
  on "public"."wagers"
  as permissive
  for insert
  to authenticated
with check (false);



  create policy "Wagers access"
  on "public"."wagers"
  as permissive
  for select
  to authenticated
using (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.bets
  WHERE ((bets.id = wagers.bet_id) AND ((bets.status = 'resolved'::text) OR (bets.creator_id = auth.uid())))))));


CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


