import { supabase } from '../lib/supabase.js';
import { getStreakData } from './streaks.js';

export async function signUp(email, password, username) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username }
    }
  });

  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, user, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  
  await loadProfile(user);
  return user;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function loadProfile(user) {
  if (!user) {
    return null;
  }

  const { data: bonusResult, error: bonusError } = await supabase.rpc('process_daily_bonus');

  if (bonusError) {
    console.error('Failed to process daily bonus:', bonusError);
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error && error.code === 'PGRST116') {
      return null;
    }
    if (error) throw error;
    return profile;
  }

  if (!bonusResult || bonusResult.length === 0) {
    return null;
  }

  const row = bonusResult[0];
  return {
    id: row.out_id,
    username: row.out_username,
    points: row.out_points,
    is_admin: row.out_is_admin,
    last_login: row.out_last_login,
    login_streak: row.out_login_streak,
    created_at: row.out_created_at,
    rescues_remaining: row.out_rescues_remaining,
    rescues_reset_date: row.out_rescues_reset_date,
    penguin_stage: row.out_penguin_stage,
    win_streak: row.out_win_streak,
    best_win_streak: row.out_best_win_streak,
    trophy_level: row.out_trophy_level,
    streak_in_danger: row.out_streak_in_danger,
  };
}

export async function loadProfileWithStreak(user) {
  if (!user) {
    return { profile: null, streak: null };
  }

  const profile = await loadProfile(user);
  
  let streak = null;
  try {
    streak = await getStreakData();
  } catch (e) {
    console.log('Could not load streak data on login');
  }
  
  return { profile, streak };
}

export function getCurrentUser() {
  return supabase.auth.getSession();
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(async (event, session) => {
    callback(event, session);
  });
}
