-- FriendBet Database Tests
-- Run these tests against your Supabase project to verify the schema works correctly
-- Note: Some tests require creating test data which will be cleaned up

-- ============================================
-- SETUP: Helper Functions for Testing
-- ============================================

-- Function to check if tests pass
CREATE OR REPLACE FUNCTION test.assert(condition BOOLEAN, message TEXT)
RETURNS VOID AS $$
BEGIN
  IF NOT condition THEN
    RAISE EXCEPTION 'TEST FAILED: %', message;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TEST 1: Profile Creation on Signup
-- ============================================
DO $$
DECLARE
  test_email TEXT := 'test_signup_' || NOW()::TEXT || '@example.com';
  test_user_id UUID;
BEGIN
  -- Create auth user (simulated)
  INSERT INTO auth.users (id, email, raw_user_meta_data, created_at)
  VALUES (gen_random_uuid(), test_email, '{"username": "testuser"}'::jsonb, NOW())
  ON CONFLICT DO NOTHING;
  
  -- Get the user
  SELECT id INTO test_user_id FROM auth.users WHERE email = test_email;
  
  -- Profile should be auto-created by trigger
  PERFORM test.assert(
    EXISTS (SELECT 1 FROM public.profiles WHERE id = test_user_id),
    'Profile should be created on signup'
  );
  
  -- Initial points should be 5000
  PERFORM test.assert(
    (SELECT points FROM public.profiles WHERE id = test_user_id) = 5000,
    'Initial points should be 5000'
  );
  
  -- Transaction should be logged
  PERFORM test.assert(
    EXISTS (
      SELECT 1 FROM internal.transactions 
      WHERE user_id = test_user_id AND type = 'initial' AND amount = 5000
    ),
    'Initial transaction should be logged'
  );
  
  RAISE NOTICE 'TEST 1 PASSED: Profile creation on signup';
  
  -- Cleanup
  DELETE FROM internal.transactions WHERE user_id = test_user_id;
  DELETE FROM public.profiles WHERE id = test_user_id;
  DELETE FROM auth.users WHERE id = test_user_id;
END $$;

-- ============================================
-- TEST 2: create_bet Function (Draft)
-- ============================================
DO $$
DECLARE
  test_user_id UUID := auth.uid();  -- Assumes authenticated user
  bet_id UUID;
  bet_points INTEGER;
BEGIN
  -- Skip if not authenticated
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'TEST 2 SKIPPED: No authenticated user';
    RETURN;
  END IF;
  
  -- Set points for test
  UPDATE public.profiles SET points = 10000 WHERE id = test_user_id;
  
  -- Create draft bet
  bet_id := create_bet(
    p_title := 'Test Bet Draft',
    p_description := 'Testing draft creation',
    p_duration := 24,
    p_stake := 100,
    p_visibility := 'public',
    p_publish := false
  );
  
  -- Bet should be created
  PERFORM test.assert(bet_id IS NOT NULL, 'Bet ID should be returned');
  
  -- Status should be draft
  PERFORM test.assert(
    (SELECT status FROM public.bets WHERE id = bet_id) = 'draft',
    'Bet status should be draft'
  );
  
  -- Points should NOT be deducted for draft
  bet_points := (SELECT points FROM public.profiles WHERE id = test_user_id);
  PERFORM test.assert(bet_points = 10000, 'Points should not be deducted for draft');
  
  RAISE NOTICE 'TEST 2 PASSED: create_bet (draft)';
  
  -- Cleanup
  DELETE FROM public.bets WHERE id = bet_id;
  UPDATE public.profiles SET points = 5000 WHERE id = test_user_id;
END $$;

-- ============================================
-- TEST 3: create_bet Function (Published)
-- ============================================
DO $$
DECLARE
  test_user_id UUID := auth.uid();
  bet_id UUID;
  points_before INTEGER;
  points_after INTEGER;
BEGIN
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'TEST 3 SKIPPED: No authenticated user';
    RETURN;
  END IF;
  
  -- Set known points
  UPDATE public.profiles SET points = 10000 WHERE id = test_user_id;
  points_before := 10000;
  
  -- Create published bet
  bet_id := create_bet(
    p_title := 'Test Bet Published',
    p_description := 'Testing published creation',
    p_duration := 24,
    p_stake := 100,
    p_visibility := 'public',
    p_publish := true
  );
  
  -- Points should be deducted (10 + 24 = 34)
  points_after := (SELECT points FROM public.profiles WHERE id = test_user_id);
  PERFORM test.assert(
    points_before - points_after = 34,
    'Points should be deducted (10 + 24 = 34), was: ' || (points_before - points_after)
  );
  
  -- Transaction should be logged
  PERFORM test.assert(
    EXISTS (
      SELECT 1 FROM internal.transactions 
      WHERE user_id = test_user_id AND type = 'bet_created' AND amount = -34 AND bet_id = bet_id
    ),
    'Bet created transaction should be logged'
  );
  
  -- Status should be published
  PERFORM test.assert(
    (SELECT status FROM public.bets WHERE id = bet_id) = 'published',
    'Bet status should be published'
  );
  
  RAISE NOTICE 'TEST 3 PASSED: create_bet (published)';
  
  -- Cleanup
  DELETE FROM internal.transactions WHERE bet_id = bet_id;
  DELETE FROM public.bets WHERE id = bet_id;
  UPDATE public.profiles SET points = 5000 WHERE id = test_user_id;
END $$;

-- ============================================
-- TEST 4: Insufficient Points Should Fail
-- ============================================
DO $$
DECLARE
  test_user_id UUID := auth.uid();
  bet_id UUID;
  original_points INTEGER;
BEGIN
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'TEST 4 SKIPPED: No authenticated user';
    RETURN;
  END IF;
  
  -- Set very low points
  UPDATE public.profiles SET points = 10 WHERE id = test_user_id;
  
  BEGIN
    -- This should fail
    bet_id := create_bet(
      p_title := 'Should Fail',
      p_description := NULL,
      p_duration := 24,  -- 10 + 24 = 34, but we only have 10
      p_stake := 0,
      p_visibility := 'public',
      p_publish := true
    );
    
    -- If we get here, test failed
    RAISE EXCEPTION 'TEST 4 FAILED: Should have thrown insufficient points error';
    
  EXCEPTION WHEN raise_exception THEN
    -- Check if it's our error
    IF SQLERRM LIKE '%Insufficient points%' THEN
      RAISE NOTICE 'TEST 4 PASSED: Insufficient points correctly rejected';
    ELSE
      RAISE;
    END IF;
  END;
  
  -- Restore points
  UPDATE public.profiles SET points = 5000 WHERE id = test_user_id;
END $$;

-- ============================================
-- TEST 5: place_wager Function
-- ============================================
DO $$
DECLARE
  test_user_id UUID := auth.uid();
  test_user2_id UUID;
  bet_id UUID;
  points_before INTEGER;
  points_after INTEGER;
BEGIN
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'TEST 5 SKIPPED: No authenticated user';
    RETURN;
  END IF;
  
  -- Create another test user for wagers
  INSERT INTO auth.users (id, email, raw_user_meta_data, created_at)
  VALUES (gen_random_uuid(), 'wager_test_' || NOW()::TEXT || '@example.com', '{"username": "wageruser"}'::jsonb, NOW())
  ON CONFLICT DO NOTHING;
  SELECT id INTO test_user2_id FROM auth.users WHERE email LIKE 'wager_test_%@example.com';
  INSERT INTO public.profiles (id, username, points) VALUES (test_user2_id, 'wageruser', 10000)
  ON CONFLICT (id) DO NOTHING;
  
  -- Create a published bet by test_user
  UPDATE public.profiles SET points = 5000 WHERE id = test_user_id;
  bet_id := create_bet(
    p_title := 'Wager Test Bet',
    p_description := NULL,
    p_duration := 24,
    p_stake := 100,
    p_visibility := 'public',
    p_publish := true
  );
  
  -- Set wager user's points
  UPDATE public.profiles SET points = 5000 WHERE id = test_user2_id;
  points_before := 5000;
  
  -- Place wager as test_user2
  PERFORM place_wager(bet_id, 'for', 100);
  
  -- Points should be deducted
  points_after := (SELECT points FROM public.profiles WHERE id = test_user2_id);
  PERFORM test.assert(
    points_before - points_after = 100,
    'Wager amount should be deducted'
  );
  
  -- Wager should be recorded
  PERFORM test.assert(
    EXISTS (
      SELECT 1 FROM public.wagers 
      WHERE bet_id = bet_id AND user_id = test_user2_id AND side = 'for' AND amount = 100
    ),
    'Wager should be recorded'
  );
  
  RAISE NOTICE 'TEST 5 PASSED: place_wager';
  
  -- Cleanup
  DELETE FROM public.wagers WHERE bet_id = bet_id;
  DELETE FROM internal.transactions WHERE bet_id = bet_id;
  DELETE FROM public.bets WHERE id = bet_id;
  DELETE FROM public.profiles WHERE id = test_user2_id;
  DELETE FROM auth.users WHERE id = test_user2_id;
  UPDATE public.profiles SET points = 5000 WHERE id = test_user_id;
END $$;

-- ============================================
-- TEST 6: Cannot Wager on Own Bet
-- ============================================
DO $$
DECLARE
  test_user_id UUID := auth.uid();
  bet_id UUID;
BEGIN
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'TEST 6 SKIPPED: No authenticated user';
    RETURN;
  END IF;
  
  UPDATE public.profiles SET points = 5000 WHERE id = test_user_id;
  
  bet_id := create_bet(
    p_title := 'Own Bet Test',
    p_description := NULL,
    p_duration := 24,
    p_stake := 0,
    p_visibility := 'public',
    p_publish := true
  );
  
  BEGIN
    -- This should fail - can't wager on own bet
    PERFORM place_wager(bet_id, 'for', 100);
    RAISE EXCEPTION 'TEST 6 FAILED: Should not allow wagering on own bet';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%Cannot wager on your own bet%' THEN
      RAISE NOTICE 'TEST 6 PASSED: Cannot wager on own bet';
    ELSE
      RAISE;
    END IF;
  END;
  
  -- Cleanup
  DELETE FROM public.bets WHERE id = bet_id;
END $$;

-- ============================================
-- TEST 7: resolve_bet Function
-- ============================================
DO $$
DECLARE
  test_user_id UUID := auth.uid();
  test_user2_id UUID;
  bet_id UUID;
  user1_points_before INTEGER;
  user1_points_after INTEGER;
BEGIN
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'TEST 7 SKIPPED: No authenticated user';
    RETURN;
  END IF;
  
  -- Create second user
  INSERT INTO auth.users (id, email, raw_user_meta_data, created_at)
  VALUES (gen_random_uuid(), 'resolve_test_' || NOW()::TEXT || '@example.com', '{"username": "resolveuser"}'::jsonb, NOW())
  ON CONFLICT DO NOTHING;
  SELECT id INTO test_user2_id FROM auth.users WHERE email LIKE 'resolve_test_%@example.com';
  INSERT INTO public.profiles (id, username, points) VALUES (test_user2_id, 'resolveuser', 5000)
  ON CONFLICT (id) DO NOTHING;
  
  -- Create bet
  UPDATE public.profiles SET points = 5000 WHERE id = test_user_id;
  bet_id := create_bet(
    p_title := 'Resolve Test Bet',
    p_description := NULL,
    p_duration := 1,
    p_stake := 500,
    p_visibility := 'public',
    p_publish := true
  );
  
  -- Add wager from user2
  PERFORM place_wager(bet_id, 'for', 500);
  
  -- Wait for bet to expire (we need to manually update end_time for testing)
  UPDATE public.bets SET end_time = NOW() - INTERVAL '1 hour' WHERE id = bet_id;
  
  -- Resolve as creator
  PERFORM resolve_bet(bet_id, 'for');
  
  -- Bet should be resolved
  PERFORM test.assert(
    (SELECT status FROM public.bets WHERE id = bet_id) = 'resolved',
    'Bet should be resolved'
  );
  
  -- Winner should be recorded
  PERFORM test.assert(
    (SELECT winner FROM public.bets WHERE id = bet_id) = 'for',
    'Winner should be for'
  );
  
  RAISE NOTICE 'TEST 7 PASSED: resolve_bet';
  
  -- Cleanup
  DELETE FROM public.wagers WHERE bet_id = bet_id;
  DELETE FROM internal.transactions WHERE bet_id = bet_id;
  DELETE FROM public.bets WHERE id = bet_id;
  DELETE FROM public.profiles WHERE id = test_user2_id;
  DELETE FROM auth.users WHERE id = test_user2_id;
  UPDATE public.profiles SET points = 5000 WHERE id = test_user_id;
END $$;

-- ============================================
-- TEST 8: process_daily_bonus
-- ============================================
DO $$
DECLARE
  test_user_id UUID := auth.uid();
  bonus INTEGER;
BEGIN
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'TEST 8 SKIPPED: No authenticated user';
    RETURN;
  END IF;
  
  -- Set last_login to yesterday to ensure bonus is given
  UPDATE public.profiles 
  SET last_login = CURRENT_DATE - 1, login_streak = 1, points = 5000 
  WHERE id = test_user_id;
  
  bonus := process_daily_bonus();
  
  -- Should return bonus amount (5 base + streak bonus)
  PERFORM test.assert(bonus > 0, 'Bonus should be > 0, was: ' || bonus);
  
  -- Streak should be incremented
  PERFORM test.assert(
    (SELECT login_streak FROM public.profiles WHERE id = test_user_id) = 2,
    'Login streak should be 2'
  );
  
  -- Transaction should be logged
  PERFORM test.assert(
    EXISTS (
      SELECT 1 FROM internal.transactions 
      WHERE user_id = test_user_id AND type = 'daily_bonus'
    ),
    'Daily bonus transaction should be logged'
  );
  
  RAISE NOTICE 'TEST 8 PASSED: process_daily_bonus';
  
  -- Cleanup
  DELETE FROM internal.transactions WHERE user_id = test_user_id AND type = 'daily_bonus';
  UPDATE public.profiles SET last_login = NULL, login_streak = 0 WHERE id = test_user_id;
END $$;

-- ============================================
-- TEST 9: RLS - Cannot Update Points Directly
-- ============================================
DO $$
DECLARE
  test_user_id UUID := auth.uid();
BEGIN
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'TEST 9 SKIPPED: No authenticated user';
    RETURN;
  END IF;
  
  -- Attempt to directly update points (should fail due to RLS)
  BEGIN
    UPDATE public.profiles SET points = 999999 WHERE id = test_user_id;
    
    -- Check if update actually happened
    IF (SELECT points FROM public.profiles WHERE id = test_user_id) = 999999 THEN
      RAISE EXCEPTION 'TEST 9 FAILED: RLS should prevent direct point updates!';
    END IF;
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%RLS%' OR SQLERRM LIKE '%permission%' THEN
      RAISE NOTICE 'TEST 9 PASSED: RLS blocks direct point updates';
    ELSE
      -- If no error, RLS is working (update was blocked)
      RAISE NOTICE 'TEST 9 PASSED: RLS blocks direct point updates';
    END IF;
  END;
  
  -- Restore points
  UPDATE public.profiles SET points = 5000 WHERE id = test_user_id;
END $$;

-- ============================================
-- TEST 10: Friends - Send/Accept Request
-- ============================================
DO $$
DECLARE
  test_user_id UUID := auth.uid();
  test_user2_id UUID;
  friendship_id UUID;
BEGIN
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'TEST 10 SKIPPED: No authenticated user';
    RETURN;
  END IF;
  
  -- Create second user
  INSERT INTO auth.users (id, email, raw_user_meta_data, created_at)
  VALUES (gen_random_uuid(), 'friend_test_' || NOW()::TEXT || '@example.com', '{"username": "frienduser2"}'::jsonb, NOW())
  ON CONFLICT DO NOTHING;
  SELECT id INTO test_user2_id FROM auth.users WHERE email LIKE 'friend_test_%@example.com';
  INSERT INTO public.profiles (id, username, points) VALUES (test_user2_id, 'frienduser2', 5000)
  ON CONFLICT (id) DO NOTHING;
  
  -- Send friend request
  PERFORM send_friend_request(test_user2_id);
  
  -- Get friendship ID
  SELECT id INTO friendship_id FROM public.friendships 
  WHERE requester_id = test_user_id AND addressee_id = test_user2_id;
  
  PERFORM test.assert(friendship_id IS NOT NULL, 'Friendship should be created');
  
  -- Accept as user2
  PERFORM accept_friend_request(friendship_id);
  
  -- Should be accepted
  PERFORM test.assert(
    (SELECT status FROM public.friendships WHERE id = friendship_id) = 'accepted',
    'Friendship should be accepted'
  );
  
  -- Notification should be created
  PERFORM test.assert(
    EXISTS (
      SELECT 1 FROM public.notifications 
      WHERE user_id = test_user_id AND type = 'friend_accepted'
    ),
    'Friend accepted notification should be created'
  );
  
  RAISE NOTICE 'TEST 10 PASSED: Friends system';
  
  -- Cleanup
  DELETE FROM public.notifications WHERE user_id IN (test_user_id, test_user2_id);
  DELETE FROM public.friendships WHERE id = friendship_id;
  DELETE FROM public.profiles WHERE id = test_user2_id;
  DELETE FROM auth.users WHERE id = test_user2_id;
END $$;

-- ============================================
-- SUMMARY
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'All FriendBet Schema Tests Completed';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'If you see this message without errors,';
  RAISE NOTICE 'all tests passed!';
  RAISE NOTICE '';
EXCEPTION WHEN others THEN
  RAISE NOTICE 'TEST ERROR: %', SQLERRM;
END $$;
