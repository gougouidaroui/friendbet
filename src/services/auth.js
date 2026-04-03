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

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error && error.code === 'PGRST116') {
    return null;
  }

  if (error) throw error;

  try {
    await supabase.rpc('process_daily_bonus');
    
    const { data: updatedProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    return updatedProfile;
  } catch (e) {
    console.log('Daily bonus may already be processed');
    return profile;
  }
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
