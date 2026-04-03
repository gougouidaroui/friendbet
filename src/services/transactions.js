import { supabase } from '../lib/supabase.js';

export async function getTransactions(userId) {
  const { data, error } = await supabase
    .from('transaction_history')
    .select(`
      *,
      bet:bet_id (title)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
}
