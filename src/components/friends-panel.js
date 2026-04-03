import { getFriends, getPendingRequests, acceptFriendRequest, declineFriendRequest, getSuggestedUsers, sendFriendRequest } from '../services/friends.js';
import { searchUsers } from '../services/users.js';
import { getState } from '../lib/store.js';

let onSuccessCallback = null;
let searchTimeout = null;

export function openFriendsPanel(callback = null) {
  onSuccessCallback = callback;
  
  const modal = document.getElementById('friendsModal');
  if (modal) {
    modal.classList.add('active');
    loadFriends();
  }
}

export function closeFriendsPanel() {
  const modal = document.getElementById('friendsModal');
  if (modal) {
    modal.classList.remove('active');
  }
  if (searchTimeout) {
    clearTimeout(searchTimeout);
    searchTimeout = null;
  }
  onSuccessCallback = null;
}

async function loadFriends() {
  const { user } = getState();
  if (!user) return;
  
  const friendsContainer = document.getElementById('friendsList');
  const requestsContainer = document.getElementById('friendRequests');
  const suggestionsContainer = document.getElementById('suggestionsList');
  
  try {
    const [friends, requests, suggestions] = await Promise.all([
      getFriends(user.id),
      getPendingRequests(user.id),
      getSuggestedUsers(user.id),
    ]);
    
    if (friends.length === 0) {
      friendsContainer.innerHTML = '<p style="color: var(--foreground-muted); text-align: center; padding: 20px;">No friends yet</p>';
    } else {
      friendsContainer.innerHTML = friends.map(friend => `
        <div class="friend-item" data-user-id="${friend.id}">
          <div class="friend-info">
            <div class="friend-avatar">${friend.username.charAt(0).toUpperCase()}</div>
            <div class="friend-name" data-action="view-profile" data-user-id="${friend.id}">${escapeHtml(friend.username)}</div>
          </div>
        </div>
      `).join('');
    }
    
    if (requests.length === 0) {
      requestsContainer.innerHTML = '<p style="color: var(--foreground-muted); text-align: center; padding: 20px;">No pending requests</p>';
    } else {
      requestsContainer.innerHTML = requests.map(request => `
        <div class="friend-item" data-request-id="${request.id}">
          <div class="friend-info">
            <div class="friend-avatar">${request.requester.username.charAt(0).toUpperCase()}</div>
            <div>
              <div class="friend-name">${escapeHtml(request.requester.username)}</div>
              <div class="friend-status">Wants to be friends</div>
            </div>
          </div>
          <div class="request-actions">
            <button class="btn btn-success" data-action="accept" data-request-id="${request.id}">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
            <button class="btn btn-danger" data-action="decline" data-request-id="${request.id}">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      `).join('');
    }
    
    if (suggestions.length === 0) {
      suggestionsContainer.innerHTML = '<p style="color: var(--foreground-muted); text-align: center; padding: 20px;">No suggestions available</p>';
    } else {
      suggestionsContainer.innerHTML = suggestions.map(suggestion => `
        <div class="suggestion-item" data-user-id="${suggestion.id}">
          <div class="friend-info">
            <div class="friend-avatar">${suggestion.username.charAt(0).toUpperCase()}</div>
            <div>
              <div class="friend-name" data-action="view-profile" data-user-id="${suggestion.id}">${escapeHtml(suggestion.username)}</div>
              <div class="friend-status">${suggestion.points.toLocaleString()} points</div>
            </div>
          </div>
          <button class="btn btn-sm btn-primary btn-add-friend" data-action="add-friend" data-user-id="${suggestion.id}">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add
          </button>
        </div>
      `).join('');
    }
    
    attachFriendActionListeners();
  } catch (error) {
    friendsContainer.innerHTML = '<div class="error">Failed to load friends</div>';
  }
}

function attachFriendActionListeners() {
  document.querySelectorAll('[data-action="view-profile"]').forEach(el => {
    el.onclick = () => {
      const { openProfileModal } = require('./profile-modal.js');
      const userId = el.dataset.userId;
      openProfileModal(userId);
    };
  });
  
  document.querySelectorAll('[data-action="accept"]').forEach(btn => {
    btn.onclick = async () => {
      const requestId = btn.dataset.requestId;
      try {
        await acceptFriendRequest(requestId);
        loadFriends();
        if (onSuccessCallback) onSuccessCallback();
      } catch (error) {
        alert(error.message || 'Failed to accept request');
      }
    };
  });
  
  document.querySelectorAll('[data-action="decline"]').forEach(btn => {
    btn.onclick = async () => {
      const requestId = btn.dataset.requestId;
      try {
        await declineFriendRequest(requestId);
        loadFriends();
      } catch (error) {
        alert(error.message || 'Failed to decline request');
      }
    };
  });
  
  document.querySelectorAll('[data-action="add-friend"]').forEach(btn => {
    btn.onclick = async () => {
      const userId = btn.dataset.userId;
      try {
        await sendFriendRequest(userId);
        btn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Sent
        `;
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-sent');
        btn.disabled = true;
      } catch (error) {
        alert(error.message || 'Failed to send request');
      }
    };
  });
  
  const searchInput = document.getElementById('friendSearch');
  if (searchInput) {
    searchInput.oninput = handleSearch;
  }
}

async function handleSearch() {
  const { user } = getState();
  if (!user) return;
  
  const searchInput = document.getElementById('friendSearch');
  const suggestionsContainer = document.getElementById('suggestionsList');
  const query = searchInput.value.trim();
  
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  
  if (!query) {
    const suggestions = await getSuggestedUsers(user.id);
    renderSearchResults(suggestions, suggestionsContainer, 'suggestions');
    return;
  }
  
  searchTimeout = setTimeout(async () => {
    try {
      const results = await searchUsers(query, user.id);
      renderSearchResults(results, suggestionsContainer, 'search');
    } catch (error) {
      suggestionsContainer.innerHTML = '<div class="error">Failed to search users</div>';
    }
  }, 300);
}

async function renderSearchResults(users, container, type) {
  if (users.length === 0) {
    const message = type === 'search' ? 'No users found' : 'No suggestions available';
    container.innerHTML = `<p style="color: var(--foreground-muted); text-align: center; padding: 20px;">${message}</p>`;
    return;
  }
  
  const { user } = getState();
  const statuses = {};
  
  for (const u of users) {
    const { getFriendshipStatus } = await import('../services/friends.js');
    statuses[u.id] = await getFriendshipStatus(user.id, u.id);
  }
  
  container.innerHTML = users.map(u => {
    const status = statuses[u.id];
    let buttonHtml = '';
    
    if (status.status === 'friends') {
      buttonHtml = `<button class="btn btn-sm btn-friends" disabled>Friends</button>`;
    } else if (status.status === 'sent') {
      buttonHtml = `<button class="btn btn-sm btn-sent" disabled>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        Sent
      </button>`;
    } else if (status.status === 'received') {
      buttonHtml = `<button class="btn btn-sm btn-primary btn-add-friend" data-action="add-friend" data-user-id="${u.id}">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add
      </button>`;
    } else {
      buttonHtml = `<button class="btn btn-sm btn-primary btn-add-friend" data-action="add-friend" data-user-id="${u.id}">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add
      </button>`;
    }
    
    return `
      <div class="suggestion-item" data-user-id="${u.id}">
        <div class="friend-info">
          <div class="friend-avatar">${u.username.charAt(0).toUpperCase()}</div>
          <div>
            <div class="friend-name" data-action="view-profile" data-user-id="${u.id}">${escapeHtml(u.username)}</div>
            <div class="friend-status">${u.points != null ? u.points.toLocaleString() + ' points' : ''}</div>
          </div>
        </div>
        ${buttonHtml}
      </div>
    `;
  }).join('');
  
  attachFriendActionListeners();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function renderFriendsPanel() {
  return `
    <div class="modal-overlay" id="friendsModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Friends</h2>
          <button class="close-btn" id="closeFriendsModal" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="friend-search">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="friendSearch" placeholder="Search users..." autocomplete="off" />
        </div>
        <div class="friends-section">
          <h3>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
            Suggestions
          </h3>
          <div id="suggestionsList"></div>
        </div>
        <div class="friends-section">
          <h3>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
            Friend Requests
          </h3>
          <div id="friendRequests"></div>
        </div>
        <div class="friends-section">
          <h3>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Your Friends
          </h3>
          <div id="friendsList"></div>
        </div>
      </div>
    </div>
  `;
}

export function attachFriendsPanelListeners() {
  const modal = document.getElementById('friendsModal');
  if (!modal) return;
  
  document.getElementById('closeFriendsModal').onclick = closeFriendsPanel;
  
  modal.onclick = (e) => {
    if (e.target === modal) closeFriendsPanel();
  };
}
