import { getAllUsers, adjustPoints } from '../services/admin.js';

let allUsers = [];
let filteredUsers = [];

export async function loadUsers() {
  const container = document.getElementById('adminContent');
  if (!container) return;

  container.innerHTML = `
    <div class="admin-toolbar">
      <input type="text" class="admin-search-input" id="adminUserSearch" placeholder="Search users...">
    </div>
    <div id="adminUsersList" class="admin-table-container">
      <div class="loader"></div>
    </div>
  `;

  try {
    allUsers = await getAllUsers();
    filteredUsers = [...allUsers];
    renderUsersTable();
    attachUserSearchListener();
  } catch (error) {
    container.innerHTML = `<div class="error">Failed to load users: ${error.message}</div>`;
  }
}

function renderUsersTable() {
  const list = document.getElementById('adminUsersList');
  if (!list) return;

  if (filteredUsers.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>No users found</p></div>';
    return;
  }

  list.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>User</th>
          <th>Points</th>
          <th>Streak</th>
          <th>Joined</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${filteredUsers.map(u => `
          <tr>
            <td>
              <div class="admin-user-cell">
                <div class="admin-user-avatar">${(u.username || '?')[0].toUpperCase()}</div>
                <div>
                  <div class="admin-user-name">${u.username || 'Unknown'}</div>
                  <div class="admin-user-id">${u.id?.slice(0, 8) || ''}</div>
                </div>
              </div>
            </td>
            <td class="admin-td-points">${(u.points || 0).toLocaleString()}</td>
            <td>${u.login_streak || 0}</td>
            <td>${u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
            <td>
              <div class="admin-user-actions">
                <button class="admin-btn-sm admin-btn-adjust" data-user-id="${u.id}" data-user-name="${u.username}">
                  Adjust Points
                </button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  document.querySelectorAll('.admin-btn-adjust').forEach(btn => {
    btn.addEventListener('click', () => showAdjustDialog(btn.dataset.userId, btn.dataset.userName));
  });
}

function attachUserSearchListener() {
  const input = document.getElementById('adminUserSearch');
  if (!input) return;
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    filteredUsers = q
      ? allUsers.filter(u => (u.username || '').toLowerCase().includes(q))
      : [...allUsers];
    renderUsersTable();
  });
}

function showAdjustDialog(userId, username) {
  const amount = prompt(`Adjust points for ${username}:\n(positive to add, negative to subtract)`);
  if (amount === null) return;
  const num = parseInt(amount, 10);
  if (isNaN(num) || num === 0) {
    alert('Enter a valid non-zero number');
    return;
  }
  const reason = prompt('Reason (optional):');
  adjustPoints(userId, num, reason || 'Admin adjustment')
    .then(() => {
      alert(`Successfully ${num > 0 ? 'added' : 'removed'} ${Math.abs(num)} points from ${username}`);
      loadUsers();
    })
    .catch(e => alert('Failed: ' + e.message));
}
