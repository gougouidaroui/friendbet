import { supabase } from '../lib/supabase.js';
import { getFriendIds } from './friends.js';

export async function createBet(bet, userId, publish = false) {
  const { data, error } = await supabase.rpc('create_bet', {
    p_title: bet.title,
    p_description: bet.description || null,
    p_duration: bet.duration,
    p_stake: bet.stake || 0,
    p_visibility: bet.visibility || 'public',
    p_publish: publish
  });

  if (error) throw error;
  
  if (publish) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('points')
      .eq('id', userId)
      .single();
    
    return { id: data, points: profile?.points };
  }
  
  return { id: data };
}

export async function updateBet(betId, updates) {
  const { error } = await supabase.rpc('update_bet', {
    p_bet_id: betId,
    p_title: updates.title,
    p_description: updates.description || null,
    p_duration: updates.duration,
    p_stake: updates.stake || 0,
    p_visibility: updates.visibility || 'public'
  });

  if (error) throw error;
}

export async function publishBet(betId) {
  const { error } = await supabase.rpc('publish_bet', {
    p_bet_id: betId
  });

  if (error) throw error;
}

export async function deleteBet(betId) {
  const { error } = await supabase.rpc('delete_bet', {
    p_bet_id: betId
  });

  if (error) throw error;
}

export async function getBet(betId) {
  const { data, error } = await supabase
    .from('bets')
    .select(`
      *,
      creator:creator_id (id, username)
    `)
    .eq('id', betId)
    .single();
  
  if (error) throw error;
  return data;
}

export async function getBets(userId, filter = 'all') {
  const friendIds = await getFriendIds(userId);
  friendIds.push(userId);
  
  let query = supabase
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
    .in('status', ['published', 'in_resolution', 'resolved', 'refunded'])
    .or(`visibility.eq.public,creator_id.eq.${userId}`);
  
  const { data, error } = await query
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  
  const filteredBets = data.filter(bet => {
    if (bet.visibility === 'public') return true;
    if (bet.visibility === 'friends') {
      return bet.creator_id === userId || friendIds.includes(bet.creator_id);
    }
    return false;
  });
  
  if (filter === 'mybets') {
    return filteredBets.filter(bet => 
      bet.wagers && bet.wagers.some(w => w.user_id === userId)
    );
  }
  
  return filteredBets;
}

export async function getDrafts(userId) {
  const { data, error } = await supabase
    .from('bets')
    .select(`
      *,
      creator:creator_id (id, username)
    `)
    .eq('creator_id', userId)
    .eq('status', 'draft')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
}

export async function placeWager(betId, userId, side, amount) {
  const { error } = await supabase.rpc('place_wager', {
    p_bet_id: betId,
    p_side: side,
    p_amount: amount
  });

  if (error) throw error;
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('points')
    .eq('id', userId)
    .single();
  
  return profile?.points || 0;
}

export async function resolveBet(betId, winner, userId) {
  const { error } = await supabase.rpc('resolve_bet', {
    p_bet_id: betId,
    p_winner: winner
  });

  if (error) throw error;
}

export async function getBetWithUsernames(betId) {
  const { data: bet, error } = await supabase
    .from('bets')
    .select(`
      *,
      creator:creator_id (id, username),
      wagers (
        user_id,
        side,
        amount
      )
    `)
    .eq('id', betId)
    .single();
  
  if (error || !bet) return null;
  
  const userIds = bet.wagers.map(w => w.user_id);
  if (userIds.length === 0) return bet;
  
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', userIds);
  
  const usernameMap = {};
  profiles.forEach(p => {
    usernameMap[p.id] = p.username;
  });
  
  return {
    ...bet,
    wagers: bet.wagers.map(w => ({
      ...w,
      username: usernameMap[w.user_id] || 'Unknown',
    })),
  };
}

export function subscribeToBets(callback) {
  return supabase
    .channel('bets_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bets',
      },
      (payload) => callback(payload)
    )
    .subscribe();
}
