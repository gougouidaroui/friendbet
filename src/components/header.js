import { getState } from '../lib/store.js';

const stageIcons = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="13" rx="7" ry="9"/><path d="M10 10 Q12 8 14 10"/></svg>`,
  `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="14" rx="5" ry="7"/><circle cx="12" cy="8" r="4"/><circle cx="10.5" cy="7.5" r="1" fill="currentColor"/><circle cx="13.5" cy="7.5" r="1" fill="currentColor"/><path d="M11 9.5 Q12 10 13 9.5"/></svg>`,
  `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="14" rx="6" ry="8"/><circle cx="12" cy="7" r="4.5"/><circle cx="10" cy="6.5" r="1.2" fill="currentColor"/><circle cx="14" cy="6.5" r="1.2" fill="currentColor"/><path d="M10.5 8.5 Q12 9.5 13.5 8.5"/><path d="M7 10 Q5 8 6 6"/><path d="M17 10 Q19 8 18 6"/></svg>`,
  `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="14" rx="6" ry="8"/><circle cx="12" cy="6" r="5"/><circle cx="10" cy="5.5" r="1.2" fill="currentColor"/><circle cx="14" cy="5.5" r="1.2" fill="currentColor"/><path d="M10.5 7.5 Q12 8.5 13.5 7.5"/><path d="M6 10 Q4 7 5 4"/><path d="M18 10 Q20 7 19 4"/><path d="M9 2 Q10 0 12 1 Q14 0 15 2"/></svg>`,
  `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="14" rx="7" ry="9"/><circle cx="12" cy="5" r="5"/><circle cx="10" cy="4.5" r="1.3" fill="currentColor"/><circle cx="14" cy="4.5" r="1.3" fill="currentColor"/><path d="M10.5 6.5 Q12 7.5 13.5 6.5"/><path d="M5 10 Q3 7 4 3"/><path d="M19 10 Q21 7 20 3"/><path d="M8 1 Q9 -1 12 0 Q15 -1 16 1"/><path d="M10 0 L11 -2 L12 0.5 L13 -2 L14 0"/></svg>`
];

export function renderHeader() {
  const { profile, unreadCount, streak } = getState();
  const penguinStage = streak?.penguin_stage ?? profile?.penguin_stage ?? 0;
  const inDanger = streak?.streak_in_danger ?? profile?.streak_in_danger ?? false;

  return `
    <div class="header">
      <div class="header-left">
        <div class="avatar" id="headerAvatar" role="button" aria-label="View your profile">${profile?.username?.charAt(0).toUpperCase() || '?'}</div>
        <div class="user-info">
          <h3 id="headerUsername">${profile?.username || 'User'}</h3>
          <div class="points" id="headerPoints">${(profile?.points || 0).toLocaleString()} pts</div>
        </div>
      </div>
      <div class="header-actions">
        <button class="icon-btn penguin-btn ${inDanger ? 'penguin-danger' : ''}" id="streakBtn" title="Streaks & Achievements" aria-label="Streaks and Achievements">
          ${stageIcons[Math.min(penguinStage, 4)]}
          ${streak?.login_streak > 0 ? `<span class="penguin-streak-count">${streak.login_streak}</span>` : ''}
        </button>
        <button class="icon-btn" id="notificationsBtn" title="Notifications" aria-label="Notifications">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          ${unreadCount > 0 ? `<span class="notification-dot"></span>` : ''}
        </button>
        <button class="icon-btn" id="friendsBtn" title="Friends" aria-label="Friends">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </button>
        <button class="icon-btn" id="historyBtn" title="History" aria-label="Transaction history">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </button>
        ${profile?.is_admin ? `
          <button class="icon-btn" id="adminBtn" title="Admin" aria-label="Admin panel">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        ` : ''}
        <button class="icon-btn" id="logoutBtn" title="Logout" aria-label="Logout">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>
      </div>
    </div>
  `;
}

export function updateHeader() {
  const { profile, streak } = getState();
  
  const avatar = document.getElementById('headerAvatar');
  const username = document.getElementById('headerUsername');
  const points = document.getElementById('headerPoints');
  
  if (avatar) avatar.textContent = profile?.username?.charAt(0).toUpperCase() || '?';
  if (username) username.textContent = profile?.username || 'User';
  if (points) points.textContent = `${(profile?.points || 0).toLocaleString()} pts`;
  
  const streakBtn = document.getElementById('streakBtn');
  if (streakBtn) {
    const penguinStage = streak?.penguin_stage ?? profile?.penguin_stage ?? 0;
    const inDanger = streak?.streak_in_danger ?? profile?.streak_in_danger ?? false;
    streakBtn.className = `icon-btn penguin-btn ${inDanger ? 'penguin-danger' : ''}`;
    streakBtn.innerHTML = `${stageIcons[Math.min(penguinStage, 4)]}${streak?.login_streak > 0 ? `<span class="penguin-streak-count">${streak.login_streak}</span>` : ''}`;
  }
}
