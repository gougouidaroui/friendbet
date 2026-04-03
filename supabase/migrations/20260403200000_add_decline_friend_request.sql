set check_function_bodies = off;

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
END;
$function$
;
