import { getState } from '../lib/store.js';
import { signOut } from '../services/auth.js';
import { onAuthStateChange } from '../services/auth.js';

let currentTab = 'overview';
let onTabChangeCallback = null;

export function renderAdminTabs() {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'grid' },
    { id: 'users', label: 'Users', icon: 'users' },
    { id: 'bets', label: 'Bets', icon: 'bet' },
    { id: 'logs', label: 'Logs', icon: 'list' },
    { id: 'courts', label: 'Courts', icon: 'gavel' },
  ];

  return `
    <div class="admin-tabs">
      ${tabs.map(t => `
        <button class="admin-tab ${t.id === currentTab ? 'active' : ''}" data-tab="${t.id}">
          ${getTabIcon(t.icon)}
          <span>${t.label}</span>
        </button>
      `).join('')}
    </div>
  `;
}

function getTabIcon(type) {
  const icons = {
    grid: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    users: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    bet: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    list: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    gavel: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14.5 12.5-8 8a2.119 2.119 0 0 1-2.998 0 2.119 2.119 0 0 1 0-2.998l8-8"/><path d="m16 16 6-6"/><path d="m8 8 6-6"/><path d="m9 7 8 8"/><path d="m21 11-8-8"/></svg>',
  };
  return icons[type] || '';
}

export function renderAdminDashboard() {
  const { profile } = getState();
  return `
    <main class="admin-dashboard active">
      <div class="admin-container">
        <div class="admin-header">
          <div class="admin-header-left">
            <h1>Admin Dashboard</h1>
          </div>
          <div class="admin-header-right">
            <span class="admin-user-badge">Admin: ${profile?.username || 'Unknown'}</span>
            <button class="admin-logout-btn" id="adminLogoutBtn">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Logout
            </button>
          </div>
        </div>
        ${renderAdminTabs()}
        <div class="admin-content" id="adminContent">
          <div class="loader"></div>
        </div>
      </div>
    </main>
  `;
}

export function attachAdminDashboardListeners(tabChangeCallback) {
  onAuthStateChange(async (event) => {
    if (event === 'SIGNED_OUT') {
      resetAdminTab();
    }
  });

  onTabChangeCallback = tabChangeCallback;

  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab === currentTab) return;
      currentTab = tab;
      document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (onTabChangeCallback) onTabChangeCallback(tab);
    });
  });

  const logoutBtn = document.getElementById('adminLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await signOut();
    });
  }
}

export function getCurrentAdminTab() {
  return currentTab;
}

export function resetAdminTab() {
  currentTab = 'overview';
}
