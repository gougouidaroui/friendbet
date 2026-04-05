import { supabase } from '../lib/supabase.js';
import { get, set, invalidate } from '../lib/cache.js';

const FRIENDS_TTL = 5 * 60 * 1000;

export function invalidateFriendCache() {
  invalidate('friends');
  invalidate('friendIds');
}

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
  invalidateFriendCache();
}

export async function declineFriendRequest(friendshipId) {
  const { error } = await supabase.rpc('decline_friend_request', {
    p_friendship_id: friendshipId
  });
  
  if (error) throw error;
}

export async function getFriends(userId) {
  const cached = get('friends');
  if (cached) return cached;

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
  
  const friends = data.map(f => {
    const friend = f.requester_id === userId ? f.addressee : f.requester;
    return { friendshipId: f.id, ...friend };
  });

  set('friends', friends, FRIENDS_TTL);
  return friends;
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
  const cached = get('friendIds');
  if (cached) return cached;

  const friends = await getFriends(userId);
  const ids = friends.map(f => f.id);
  set('friendIds', ids, FRIENDS_TTL);
  return ids;
}

export async function removeFriend(friendshipId) {
  const { error } = await supabase.rpc('remove_friend', {
    p_friendship_id: friendshipId
  });
  
  if (error) throw error;
  invalidateFriendCache();
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

export async function getSentRequests(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select(`
      id,
      created_at,
      addressee:addressee_id (id, username)
    `)
    .eq('requester_id', userId)
    .eq('status', 'pending');

  if (error) throw error;
  return data;
}

export async function getFriendshipStatus(currentUserId, otherUserId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('id, status, requester_id, addressee_id')
    .or(`and(requester_id.eq.${currentUserId},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${currentUserId})`)
    .maybeSingle();

  if (error) throw error;

  if (!data) return { status: 'none' };

  if (data.status === 'accepted') {
    return { status: 'friends', friendshipId: data.id };
  }

  if (data.status === 'pending') {
    if (data.requester_id === currentUserId) {
      return { status: 'sent', friendshipId: data.id };
    } else {
      return { status: 'received', friendshipId: data.id };
    }
  }

  return { status: 'none' };
}

export async function getSuggestedUsers(userId, limit = 8) {
  const { data: friendships, error: friendsError } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id, status')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  if (friendsError) throw friendsError;

  const excludedIds = [userId];
  friendships.forEach(f => {
    excludedIds.push(f.requester_id);
    excludedIds.push(f.addressee_id);
  });

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, points')
    .not('id', 'in', `(${excludedIds.join(',')})`)
    .order('points', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}
