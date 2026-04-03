import { supabase } from '../lib/supabase.js';

export async function getStreakData() {
  const { data, error } = await supabase.rpc('get_streak_data');
  if (error) throw error;
  return data?.[0] || null;
}

export async function useRescue() {
  const { data, error } = await supabase.rpc('use_rescue');
  if (error) throw error;
  return data?.[0];
}

export async function getPenguinCalendar() {
  const { data, error } = await supabase.rpc('get_penguin_calendar');
  if (error) throw error;
  return data || [];
}

export async function updateWinStreak(won) {
  const { data, error } = await supabase.rpc('update_win_streak', { p_won: won });
  if (error) throw error;
  return data?.[0] || null;
}

export function subscribeToStreakChanges(userId, callback) {
  return supabase
    .channel('streak_changes')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${userId}`,
      },
      (payload) => callback(payload.new)
    )
    .subscribe();
}
