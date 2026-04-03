import { supabase } from '../lib/supabase.js';

export async function sendFriendRequest(addresseeId) {
  const { error } = await supabase.rpc('send_friend_request', {
    p_addressee_id: addresseeId
  });
  
  if (error) throw error;
}

export async function acceptFriendRequest(friendshipId) {
  const { error } = await supabase.rpc('accept_friend_request', {
    p_friendship_id: friendshipId
  });
  
  if (error) throw error;
}

export async function declineFriendRequest(friendshipId) {
  const { error } = await supabase.rpc('decline_friend_request', {
    p_friendship_id: friendshipId
  });
  
  if (error) throw error;
}

export async function getFriends(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select(`
      id,
      status,
      created_at,
      requester:requester_id (id, username),
      addressee:addressee_id (id, username)
    `)
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq('status', 'accepted');
  
  if (error) throw error;
  
  return data.map(f => {
    const friend = f.requester_id === userId ? f.addressee : f.requester;
    return { friendshipId: f.id, ...friend };
  });
}

export async function getPendingRequests(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select(`
      id,
      created_at,
      requester:requester_id (id, username)
    `)
    .eq('addressee_id', userId)
    .eq('status', 'pending');
  
  if (error) throw error;
  return data;
}

export async function getFriendIds(userId) {
  const friends = await getFriends(userId);
  return friends.map(f => f.id);
}

export async function removeFriend(friendshipId) {
  const { error } = await supabase.rpc('remove_friend', {
    p_friendship_id: friendshipId
  });
  
  if (error) throw error;
}

export function subscribeToFriendRequests(userId, callback) {
  return supabase
    .channel('friend_requests')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'friendships',
        filter: `addressee_id=eq.${userId}`,
      },
      callback
    )
    .subscribe();
}
