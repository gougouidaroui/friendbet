import { supabase } from '../lib/supabase.js';

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) throw error;
  return data;
}

export async function getProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('points', { ascending: false });
  
  if (error) throw error;
  return data;
}

export async function getUsersByIds(userIds) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', userIds);
  
  if (error) throw error;
  return data;
}

export async function updatePoints(userId, amount, reason = null) {
  const { error } = await supabase.rpc('admin_adjust_points', {
    p_target_user_id: userId,
    p_amount: amount,
    p_reason: reason
  });
  
  if (error) throw error;
}

export async function searchUsers(query, excludeUserId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .ilike('username', `%${query}%`)
    .neq('id', excludeUserId)
    .limit(10);
  
  if (error) throw error;
  return data;
}
