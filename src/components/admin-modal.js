import { getProfiles, updatePoints as updatePointsService } from '../services/users.js';
import { getState } from '../lib/store.js';

let onSuccessCallback = null;

export function openAdminModal(callback = null) {
  onSuccessCallback = callback;
  
  const modal = document.getElementById('adminModal');
  if (modal) {
    modal.classList.add('active');
    loadUsers();
  }
}

export function closeAdminModal() {
  const modal = document.getElementById('adminModal');
  if (modal) {
    modal.classList.remove('active');
  }
  onSuccessCallback = null;
}

async function loadUsers() {
  const container = document.getElementById('adminUsers');
  container.innerHTML = '<div class="loader"></div>';
  
  try {
    const users = await getProfiles();
    
    container.innerHTML = users.map(user => `
      <div class="user-row" data-user-id="${user.id}">
        <div class="user-row-info">
          <div class="user-row-avatar">${user.username.charAt(0).toUpperCase()}</div>
          <div>
            <div class="user-row-name">${escapeHtml(user.username)}</div>
            <div style="font-size: 12px; color: var(--foreground-subtle);">${user.is_admin ? 'Admin' : 'User'}</div>
          </div>
        </div>
        <div class="user-row-points">${user.points.toLocaleString()} pts</div>
      </div>
    `).join('');
  } catch (error) {
    container.innerHTML = '<div class="error">Failed to load users</div>';
  }
}

async function adjustPoints() {
  const username = document.getElementById('adminTargetUser').value.trim();
  const amount = parseInt(document.getElementById('adminPointsAdjust').value);
  
  if (!username || isNaN(amount)) {
    alert('Please enter username and amount');
    return;
  }
  
  try {
    const users = await getProfiles();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    
    if (!user) {
      alert('User not found');
      return;
    }
    
    await updatePointsService(user.id, amount, 'Admin adjustment');
    document.getElementById('adminTargetUser').value = '';
    document.getElementById('adminPointsAdjust').value = '';
    
    alert(`Adjusted ${user.username}'s points by ${amount >= 0 ? '+' : ''}${amount}`);
    loadUsers();
    
    if (onSuccessCallback) onSuccessCallback();
  } catch (error) {
    alert(error.message || 'Failed to adjust points');
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function renderAdminModal() {
  return `
    <div class="modal-overlay" id="adminModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Admin Panel</h2>
          <button class="close-btn" id="closeAdminModal" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="admin-section">
          <h3>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            All Users
          </h3>
          <div id="adminUsers"></div>
        </div>
        <div class="admin-section">
          <h3>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Quick Actions
          </h3>
          <div class="input-group">
            <label>Username</label>
            <input type="text" id="adminTargetUser" placeholder="Username">
          </div>
          <div class="input-group">
            <label>Points Adjustment</label>
            <input type="number" id="adminPointsAdjust" placeholder="Amount">
          </div>
          <button class="btn btn-primary btn-block" id="adjustPointsBtn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            Adjust Points
          </button>
        </div>
      </div>
    </div>
  `;
}

export function attachAdminModalListeners() {
  const modal = document.getElementById('adminModal');
  if (!modal) return;
  
  document.getElementById('closeAdminModal').onclick = closeAdminModal;
  
  modal.onclick = (e) => {
    if (e.target === modal) closeAdminModal();
  };
  
  document.getElementById('adjustPointsBtn').onclick = adjustPoints;
}
