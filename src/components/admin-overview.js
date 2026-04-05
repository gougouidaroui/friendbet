import { getStats } from '../services/admin.js';

export async function loadOverview() {
  const container = document.getElementById('adminContent');
  if (!container) return;

  container.innerHTML = '<div class="loader"></div>';

  try {
    const stats = await getStats();
    container.innerHTML = `
      <div class="admin-stats-grid">
        ${statCard('Total Users', stats.total_users?.toLocaleString() || '0', 'users')}
        ${statCard('Active Bets', stats.active_bets?.toLocaleString() || '0', 'active')}
        ${statCard('Resolved Bets', stats.resolved_bets?.toLocaleString() || '0', 'resolved')}
        ${statCard('Refunded Bets', stats.refunded_bets?.toLocaleString() || '0', 'refunded')}
        ${statCard('Points in Circulation', stats.total_points?.toLocaleString() || '0', 'points')}
        ${statCard('Total Wagers', stats.total_wagers?.toLocaleString() || '0', 'wagers')}
        ${statCard('Pending Courts', stats.pending_courts?.toLocaleString() || '0', 'courts')}
        ${statCard('Today\'s Logins', stats.today_logins?.toLocaleString() || '0', 'logins')}
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="error">Failed to load stats: ${error.message}</div>`;
  }
}

function statCard(label, value, type) {
  const icons = {
    users: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    active: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    resolved: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    refunded: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
    points: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    wagers: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
    courts: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    logins: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>',
  };

  return `
    <div class="admin-stat-card">
      <div class="admin-stat-icon">${icons[type] || ''}</div>
      <div class="admin-stat-value">${value}</div>
      <div class="admin-stat-label">${label}</div>
    </div>
  `;
}
