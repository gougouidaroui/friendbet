import { supabase } from '../lib/supabase.js';

export async function getNotifications(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .select(`
      *,
      from_user:from_user_id (id, username),
      bet:bet_id (title)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (error) throw error;
  return data;
}

export async function getUnreadCount(userId) {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  
  if (error) throw error;
  return count || 0;
}

export async function markAsRead(notificationId) {
  const { error } = await supabase.rpc('mark_notification_read', {
    p_notification_id: notificationId
  });
  
  if (error) console.error('Failed to mark notification read:', error);
}

export function subscribeToNotifications(userId, callback) {
  return supabase
    .channel('notifications_changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      callback
    )
    .subscribe();
}
