import { getNotifications, getUnreadCount, markAsRead } from '../services/notifications.js';
import { getState, updateNotifications } from '../lib/store.js';

let onSuccessCallback = null;

export function openNotificationsModal(callback = null) {
  onSuccessCallback = callback;
  
  const modal = document.getElementById('notificationsModal');
  if (modal) {
    modal.classList.add('active');
    loadNotifications();
  }
}

export function closeNotificationsModal() {
  const modal = document.getElementById('notificationsModal');
  if (modal) {
    modal.classList.remove('active');
  }
  onSuccessCallback = null;
}

async function loadNotifications() {
  const { user } = getState();
  if (!user) return;
  
  const container = document.getElementById('notificationsList');
  
  try {
    const notifications = await getNotifications(user.id);
    const unreadCount = await getUnreadCount(user.id);
    updateNotifications(notifications, unreadCount);
    
    if (notifications.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <h3>No notifications</h3>
          <p>You're all caught up!</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = notifications.map(notif => {
      const time = new Date(notif.created_at).toLocaleString();
      let icon = '';
      let message = '';
      let iconClass = '';

      switch (notif.type) {
        case 'friend_request':
          icon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>';
          message = `${notif.from_user?.username || 'Someone'} sent you a friend request`;
          iconClass = 'friend-request';
          break;
        case 'friend_accepted':
          icon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
          message = `${notif.from_user?.username || 'Someone'} accepted your friend request`;
          iconClass = 'friend-accepted';
          break;
        case 'friend_declined':
          icon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
          message = `${notif.from_user?.username || 'Someone'} declined your friend request`;
          iconClass = 'friend-declined';
          break;
        case 'friend_bet':
          icon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>';
          message = `${notif.from_user?.username || 'A friend'} created a new bet: ${notif.bet?.title || 'Unknown'}`;
          iconClass = 'friend-bet';
          break;
        case 'bet_resolved':
          icon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>';
          message = `Bet "${notif.bet?.title || 'Unknown'}" has been resolved`;
          iconClass = 'bet-resolved';
          break;
        default:
          icon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
          message = notif.type;
          iconClass = 'friend-bet';
      }
      
      return `
        <div class="notification-item ${notif.read ? '' : 'unread'}" data-notification-id="${notif.id}" role="button" tabindex="0">
          <div class="notification-icon ${iconClass}">${icon}</div>
          <div class="notification-content">
            <div class="notification-message">${message}</div>
            <div class="notification-time">${time}</div>
          </div>
        </div>
      `;
    }).join('');
    
    attachNotificationListeners();
  } catch (error) {
    container.innerHTML = '<div class="error">Failed to load notifications</div>';
  }
}

function attachNotificationListeners() {
  document.querySelectorAll('[data-notification-id]').forEach(el => {
    el.onclick = async () => {
      const notifId = el.dataset.notificationId;
      if (!el.classList.contains('unread')) return;
      
      try {
        await markAsRead(notifId);
        el.classList.remove('unread');
        
        const { user } = getState();
        const unreadCount = await getUnreadCount(user.id);
        updateNotifications(getState().notifications, unreadCount);
      } catch (error) {
        console.error('Failed to mark as read:', error);
      }
    };
  });
}

export function renderNotificationsModal() {
  return `
    <div class="modal-overlay" id="notificationsModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Notifications</h2>
          <button class="close-btn" id="closeNotificationsModal">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div id="notificationsList"></div>
      </div>
    </div>
  `;
}

export function attachNotificationsModalListeners() {
  const modal = document.getElementById('notificationsModal');
  if (!modal) return;
  
  document.getElementById('closeNotificationsModal').onclick = closeNotificationsModal;
  
  modal.onclick = (e) => {
    if (e.target === modal) closeNotificationsModal();
  };
}
