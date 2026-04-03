-- Fix: Grant USAGE on internal schema and SELECT on internal.transactions
-- Required for transaction_history view to work for authenticated users

GRANT USAGE ON SCHEMA internal TO authenticated;
GRANT SELECT ON internal.transactions TO authenticated;
