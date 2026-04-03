import { getProfile } from '../services/users.js';
import { getFriends, sendFriendRequest, removeFriend } from '../services/friends.js';
import { getStreakData } from '../services/streaks.js';
import { getState } from '../lib/store.js';

let currentProfileId = null;
let onSuccessCallback = null;

export function openProfileModal(userId, callback = null) {
  currentProfileId = userId;
  onSuccessCallback = callback;
  
  const modal = document.getElementById('profileModal');
  if (modal) {
    modal.classList.add('active');
    loadProfile(userId);
  }
}

export function closeProfileModal() {
  const modal = document.getElementById('profileModal');
  if (modal) {
    modal.classList.remove('active');
  }
  currentProfileId = null;
  onSuccessCallback = null;
}

async function loadProfile(userId) {
  const container = document.getElementById('profileContent');
  const { user } = getState();
  
  container.innerHTML = '<div class="loader"></div>';
  
  try {
    const profile = await getProfile(userId);
    const friends = await getFriends(user.id);
    const areFriends = friends.some(f => f.id === userId);
    const isSelf = user.id === userId;
    
    const joinDate = new Date(profile.created_at).toLocaleDateString();
    
    let streakData = null;
    if (isSelf) {
      try {
        streakData = await getStreakData();
      } catch (e) {
        console.log('Could not load streak data');
      }
    }
    
    container.innerHTML = `
      <div class="profile-header">
        <div class="profile-avatar">${profile.username.charAt(0).toUpperCase()}</div>
        <div class="profile-name">${escapeHtml(profile.username)}</div>
        <div style="color: var(--foreground-muted); font-size: 13px;">Joined ${joinDate}</div>
      </div>
      <div class="profile-stats">
        <div class="profile-stat">
          <div class="profile-stat-value">${profile.points.toLocaleString()}</div>
          <div class="profile-stat-label">Points</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-value">${friends.length}</div>
          <div class="profile-stat-label">Friends</div>
        </div>
        ${isSelf && streakData ? `
          <div class="profile-stat">
            <div class="profile-stat-value">${streakData.login_streak}</div>
            <div class="profile-stat-label">Streak</div>
          </div>
          <div class="profile-stat">
            <div class="profile-stat-value">${streakData.win_streak}</div>
            <div class="profile-stat-label">Wins</div>
          </div>
        ` : ''}
      </div>
      ${!isSelf ? `
        <div style="margin-top: var(--spacing-6); display: flex; gap: var(--spacing-2);">
          ${areFriends ? `
            <button class="btn btn-danger btn-block" id="removeFriendBtn">Remove Friend</button>
          ` : `
            <button class="btn btn-primary btn-block" id="addFriendBtn">Add Friend</button>
          `}
        </div>
      ` : ''}
    `;
    
    if (!isSelf && !areFriends) {
      document.getElementById('addFriendBtn').onclick = async () => {
        try {
          await sendFriendRequest(userId);
          document.getElementById('addFriendBtn').textContent = 'Request Sent';
          document.getElementById('addFriendBtn').disabled = true;
        } catch (error) {
          alert(error.message || 'Failed to send request');
        }
      };
    }
    
    if (!isSelf && areFriends) {
      const friendship = friends.find(f => f.id === userId);
      document.getElementById('removeFriendBtn').onclick = async () => {
        if (confirm('Remove this friend?')) {
          try {
            await removeFriend(friendship.friendshipId);
            closeProfileModal();
            if (onSuccessCallback) onSuccessCallback();
          } catch (error) {
            alert(error.message || 'Failed to remove friend');
          }
        }
      };
    }
  } catch (error) {
    container.innerHTML = '<div class="error">Failed to load profile</div>';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function renderProfileModal() {
  return `
    <div class="modal-overlay" id="profileModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Profile</h2>
          <button class="close-btn" id="closeProfileModal" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div id="profileContent"></div>
      </div>
    </div>
  `;
}

export function attachProfileModalListeners() {
  const modal = document.getElementById('profileModal');
  if (!modal) return;
  
  document.getElementById('closeProfileModal').onclick = closeProfileModal;
  
  modal.onclick = (e) => {
    if (e.target === modal) closeProfileModal();
  };
}
