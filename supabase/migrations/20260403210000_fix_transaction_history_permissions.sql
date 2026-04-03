-- Fix: Grant SELECT on transaction_history view to authenticated users
-- The view was recreated but permissions were not explicitly granted

GRANT SELECT ON public.transaction_history TO authenticated;
