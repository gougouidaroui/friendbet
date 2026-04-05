import { supabase } from '../lib/supabase.js';

export async function getStats() {
  const { data, error } = await supabase.rpc('admin_get_stats');
  if (error) throw error;
  return data[0];
}

export async function getAllUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function adjustPoints(userId, amount, reason = null) {
  const { error } = await supabase.rpc('admin_adjust_points', {
    p_target_user_id: userId,
    p_amount: amount,
    p_reason: reason
  });
  if (error) throw error;
}

export async function getAllBets() {
  const { data, error } = await supabase
    .from('bets')
    .select(`
      *,
      creator:creator_id (id, username),
      wagers (
        id,
        user_id,
        side,
        amount
      )
    `)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function deleteBet(betId) {
  const { error } = await supabase.rpc('admin_delete_bet', {
    p_bet_id: betId
  });
  if (error) throw error;
}

export async function forceResolve(betId, winner) {
  const { error } = await supabase.rpc('admin_force_resolve', {
    p_bet_id: betId,
    p_winner: winner
  });
  if (error) throw error;
}

export async function getAllTransactions() {
  const { data, error } = await supabase
    .from('transaction_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data;
}

export async function getStuckCourts() {
  const { data, error } = await supabase
    .from('bet_resolutions')
    .select(`
      *,
      bet:bets (
        id,
        title,
        status,
        end_time,
        creator:creator_id (id, username),
        wagers (
          id,
          user_id,
          side,
          amount
        )
      )
    `)
    .in('status', ['proposed', 'challenged', 'voting'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
