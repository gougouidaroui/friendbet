-- Fix: Recreate transaction_history view explicitly as SECURITY INVOKER (default)
-- The view was previously created with SECURITY DEFINER, which is unsafe

DROP VIEW IF EXISTS public.transaction_history;

CREATE VIEW public.transaction_history AS
  SELECT id,
         user_id,
         type,
         amount,
         bet_id,
         created_at
  FROM internal.transactions;
