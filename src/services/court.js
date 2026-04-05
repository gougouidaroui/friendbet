import { supabase } from '../lib/supabase.js';

export async function proposeResolution(betId, outcome) {
  const { data, error } = await supabase.rpc('propose_resolution', {
    p_bet_id: betId,
    p_outcome: outcome
  });
  if (error) throw error;
  return data;
}

export async function challengeResolution(betId) {
  const { error } = await supabase.rpc('challenge_resolution', {
    p_bet_id: betId
  });
  if (error) throw error;
}

export async function startCourtVoting(betId) {
  const { data, error } = await supabase.rpc('start_court_voting', {
    p_bet_id: betId
  });
  if (error) throw error;
  return data;
}

export async function submitVoteCommit(resolutionId, commitHash) {
  const { error } = await supabase.rpc('submit_vote_commit', {
    p_resolution_id: resolutionId,
    p_commit_hash: commitHash
  });
  if (error) throw error;
}

export async function submitVoteReveal(resolutionId, voteSide) {
  const { error } = await supabase.rpc('submit_vote_reveal', {
    p_resolution_id: resolutionId,
    p_vote_side: voteSide
  });
  if (error) throw error;
}

export async function resolveCourt(betId) {
  const { error } = await supabase.rpc('resolve_court', {
    p_bet_id: betId
  });
  if (error) throw error;
}

export async function expireResolution(betId) {
  const { error } = await supabase.rpc('expire_resolution', {
    p_bet_id: betId
  });
  if (error) throw error;
}

export async function getResolutionInfo(betId) {
  const { data, error } = await supabase.rpc('get_resolution_info', {
    p_bet_id: betId
  });
  if (error) throw error;
  return data;
}

export async function getCourtParticipants(betId) {
  const { data, error } = await supabase.rpc('get_court_participants', {
    p_bet_id: betId
  });
  if (error) throw error;
  return data || [];
}

export function generateVoteCommitHash(voteSide, userId, secretSalt) {
  const input = `${voteSide}:${userId}:${secretSalt}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  return crypto.subtle.digest('SHA-256', data).then(hashBuffer => {
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  });
}

export function subscribeToResolutions(callback) {
  return supabase
    .channel('resolutions_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bet_resolutions',
      },
      (payload) => callback(payload)
    )
    .subscribe();
}
