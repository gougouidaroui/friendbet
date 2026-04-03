import { getStreakData, getPenguinCalendar, useRescue, updateWinStreak } from '../services/streaks.js';
import { getState, updateStreak } from '../lib/store.js';

function getPenguinSVG(stage, inDanger) {
  const dangerClass = inDanger ? ' penguin-danger' : '';
  const svgs = [
    `<svg viewBox="0 0 120 120" class="penguin-svg${dangerClass}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="eggGlow" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stop-color="#f0f0f5" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="#d4c5a9" stop-opacity="1"/>
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="65" rx="32" ry="40" fill="url(#eggGlow)" stroke="#c4b896" stroke-width="2"/>
      <ellipse cx="60" cy="65" rx="32" ry="40" fill="none" stroke="#e8dcc8" stroke-width="1" opacity="0.5"/>
      <path d="M52 45 Q55 42 58 45" stroke="#c4b896" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <path d="M62 45 Q65 42 68 45" stroke="#c4b896" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <ellipse cx="60" cy="75" rx="18" ry="22" fill="#f5f0e5" opacity="0.6"/>
    </svg>`,
    `<svg viewBox="0 0 120 120" class="penguin-svg${dangerClass}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="babyBody" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stop-color="#2d2d3f"/>
          <stop offset="100%" stop-color="#1a1a2e"/>
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="70" rx="22" ry="28" fill="url(#babyBody)"/>
      <ellipse cx="60" cy="72" rx="14" ry="18" fill="#f5f0e5"/>
      <circle cx="60" cy="48" r="16" fill="url(#babyBody)"/>
      <circle cx="54" cy="45" r="3" fill="white"/>
      <circle cx="66" cy="45" r="3" fill="white"/>
      <circle cx="54" cy="45" r="1.5" fill="#1a1a2e"/>
      <circle cx="66" cy="45" r="1.5" fill="#1a1a2e"/>
      <ellipse cx="60" cy="52" rx="4" ry="2.5" fill="#f59e0b"/>
      <ellipse cx="52" cy="50" rx="3" ry="2" fill="#fbbf24" opacity="0.4"/>
      <ellipse cx="68" cy="50" rx="3" ry="2" fill="#fbbf24" opacity="0.4"/>
      <ellipse cx="50" cy="80" rx="6" ry="4" fill="#f59e0b" opacity="0.8"/>
      <ellipse cx="70" cy="80" rx="6" ry="4" fill="#f59e0b" opacity="0.8"/>
      <path d="M42 62 Q38 55 40 48" stroke="#2d2d3f" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M78 62 Q82 55 80 48" stroke="#2d2d3f" stroke-width="4" fill="none" stroke-linecap="round"/>
    </svg>`,
    `<svg viewBox="0 0 120 120" class="penguin-svg${dangerClass}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="smallBody" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stop-color="#2d2d3f"/>
          <stop offset="100%" stop-color="#1a1a2e"/>
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="72" rx="24" ry="30" fill="url(#smallBody)"/>
      <ellipse cx="60" cy="74" rx="16" ry="20" fill="#f5f0e5"/>
      <circle cx="60" cy="44" r="18" fill="url(#smallBody)"/>
      <circle cx="53" cy="41" r="3.5" fill="white"/>
      <circle cx="67" cy="41" r="3.5" fill="white"/>
      <circle cx="53" cy="41" r="2" fill="#1a1a2e"/>
      <circle cx="67" cy="41" r="2" fill="#1a1a2e"/>
      <ellipse cx="60" cy="48" rx="5" ry="3" fill="#f59e0b"/>
      <ellipse cx="50" cy="46" rx="4" ry="2.5" fill="#fbbf24" opacity="0.4"/>
      <ellipse cx="70" cy="46" rx="4" ry="2.5" fill="#fbbf24" opacity="0.4"/>
      <ellipse cx="50" cy="88" rx="7" ry="5" fill="#f59e0b" opacity="0.8"/>
      <ellipse cx="70" cy="88" rx="7" ry="5" fill="#f59e0b" opacity="0.8"/>
      <path d="M40 64 Q34 56 36 46" stroke="#2d2d3f" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M80 64 Q86 56 84 46" stroke="#2d2d3f" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M55 95 Q58 100 55 105" stroke="#f59e0b" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M65 95 Q62 100 65 105" stroke="#f59e0b" stroke-width="3" fill="none" stroke-linecap="round"/>
    </svg>`,
    `<svg viewBox="0 0 120 120" class="penguin-svg${dangerClass}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="teenBody" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stop-color="#2d2d3f"/>
          <stop offset="100%" stop-color="#1a1a2e"/>
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="70" rx="26" ry="32" fill="url(#teenBody)"/>
      <ellipse cx="60" cy="72" rx="18" ry="22" fill="#f5f0e5"/>
      <circle cx="60" cy="40" r="19" fill="url(#teenBody)"/>
      <circle cx="52" cy="37" r="3.5" fill="white"/>
      <circle cx="68" cy="37" r="3.5" fill="white"/>
      <circle cx="52" cy="37" r="2" fill="#1a1a2e"/>
      <circle cx="68" cy="37" r="2" fill="#1a1a2e"/>
      <ellipse cx="60" cy="44" rx="5.5" ry="3.5" fill="#f59e0b"/>
      <ellipse cx="49" cy="42" rx="4" ry="2.5" fill="#fbbf24" opacity="0.4"/>
      <ellipse cx="71" cy="42" rx="4" ry="2.5" fill="#fbbf24" opacity="0.4"/>
      <ellipse cx="48" cy="88" rx="8" ry="5" fill="#f59e0b" opacity="0.8"/>
      <ellipse cx="72" cy="88" rx="8" ry="5" fill="#f59e0b" opacity="0.8"/>
      <path d="M38 62 Q30 52 32 40" stroke="#2d2d3f" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M82 62 Q90 52 88 40" stroke="#2d2d3f" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M54 96 Q57 102 54 108" stroke="#f59e0b" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <path d="M66 96 Q63 102 66 108" stroke="#f59e0b" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <path d="M55 30 Q58 25 60 28 Q62 25 65 30" stroke="#f59e0b" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    </svg>`,
    `<svg viewBox="0 0 120 120" class="penguin-svg${dangerClass}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="adultBody" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stop-color="#2d2d3f"/>
          <stop offset="100%" stop-color="#1a1a2e"/>
        </radialGradient>
        <linearGradient id="crown" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fbbf24"/>
          <stop offset="50%" stop-color="#f59e0b"/>
          <stop offset="100%" stop-color="#d97706"/>
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="68" rx="28" ry="34" fill="url(#adultBody)"/>
      <ellipse cx="60" cy="70" rx="20" ry="24" fill="#f5f0e5"/>
      <circle cx="60" cy="36" r="20" fill="url(#adultBody)"/>
      <circle cx="52" cy="33" r="4" fill="white"/>
      <circle cx="68" cy="33" r="4" fill="white"/>
      <circle cx="52" cy="33" r="2.2" fill="#1a1a2e"/>
      <circle cx="68" cy="33" r="2.2" fill="#1a1a2e"/>
      <ellipse cx="60" cy="40" rx="6" ry="3.5" fill="#f59e0b"/>
      <ellipse cx="48" cy="38" rx="4.5" ry="2.5" fill="#fbbf24" opacity="0.4"/>
      <ellipse cx="72" cy="38" rx="4.5" ry="2.5" fill="#fbbf24" opacity="0.4"/>
      <ellipse cx="46" cy="86" rx="9" ry="5" fill="#f59e0b" opacity="0.8"/>
      <ellipse cx="74" cy="86" rx="9" ry="5" fill="#f59e0b" opacity="0.8"/>
      <path d="M36 60 Q26 48 28 34" stroke="#2d2d3f" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M84 60 Q94 48 92 34" stroke="#2d2d3f" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M53 94 Q56 100 53 106" stroke="#f59e0b" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M67 94 Q64 100 67 106" stroke="#f59e0b" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M48 22 L52 12 L56 18 L60 8 L64 18 L68 12 L72 22" stroke="url(#crown)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="60" cy="8" r="2" fill="#fbbf24"/>
    </svg>`
  ];
  return svgs[Math.min(stage, 4)];
}

function getTrophySVG(level) {
  const colors = {
    1: { main: '#9ca3af', light: '#d1d5db' },
    2: { main: '#cd7f32', light: '#e8a862' },
    3: { main: '#c0c0c0', light: '#e8e8e8' },
    4: { main: '#f59e0b', light: '#fbbf24' },
    5: { main: '#f59e0b', light: '#fde68a' },
  };
  const c = colors[level] || colors[1];
  const glow = level >= 5 ? ' filter="url(#goldGlow)"' : '';

  return `<svg viewBox="0 0 80 100" class="trophy-svg" xmlns="http://www.w3.org/2000/svg">
    ${level >= 5 ? `<defs><filter id="goldGlow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>` : ''}
    <g${glow}>
      <path d="M25 15 L55 15 L52 45 Q50 55 40 58 Q30 55 28 45 Z" fill="${c.main}" stroke="${c.light}" stroke-width="1.5"/>
      <ellipse cx="40" cy="15" rx="15" ry="5" fill="${c.light}" opacity="0.3"/>
      <path d="M25 20 Q15 20 15 30 Q15 40 28 38" fill="none" stroke="${c.main}" stroke-width="2.5"/>
      <path d="M55 20 Q65 20 65 30 Q65 40 52 38" fill="none" stroke="${c.main}" stroke-width="2.5"/>
      <rect x="34" y="58" width="12" height="8" fill="${c.main}" rx="1"/>
      <rect x="28" y="66" width="24" height="6" fill="${c.main}" rx="2"/>
      <rect x="30" y="72" width="20" height="4" fill="${c.light}" opacity="0.5" rx="1"/>
      ${level >= 3 ? `<circle cx="40" cy="35" r="5" fill="${c.light}" opacity="0.6"/>` : ''}
      ${level >= 5 ? `<circle cx="40" cy="35" r="3" fill="#fef3c7" opacity="0.8"/>` : ''}
    </g>
  </svg>`;
}

const stageNames = ['Egg', 'Hatched', 'Baby', 'Teen', 'Adult'];
const stageDescriptions = [
  'Your penguin is still an egg. Keep logging in!',
  'Your penguin has hatched! A tiny friend.',
  'Your baby penguin is growing up nicely!',
  'Your teen penguin is getting majestic!',
  'Your adult penguin is fully grown and wears a crown!'
];

export function openStreakModal() {
  const modal = document.getElementById('streakModal');
  if (modal) {
    modal.classList.add('active');
    loadStreakModal();
  }
}

export function closeStreakModal() {
  const modal = document.getElementById('streakModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

async function loadStreakModal() {
  const container = document.getElementById('streakContent');
  container.innerHTML = '<div class="loader"></div>';

  try {
    const streak = await getStreakData();
    const calendar = await getPenguinCalendar();
    updateStreak(streak);

    container.innerHTML = `
      <div class="streak-tabs">
        <button class="streak-tab active" data-tab="penguin">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
          Penguin
        </button>
        <button class="streak-tab" data-tab="trophy">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
          Trophies
        </button>
      </div>

      <div class="streak-panel active" id="penguinPanel">
        <div class="penguin-display">
          ${getPenguinSVG(streak.penguin_stage, streak.streak_in_danger)}
          <div class="penguin-stage-name">${stageNames[streak.penguin_stage]}</div>
          <div class="penguin-stage-desc">${stageDescriptions[streak.penguin_stage]}</div>
        </div>

        <div class="streak-counter">
          <div class="streak-number">${streak.login_streak}</div>
          <div class="streak-label">day streak</div>
          ${streak.streak_in_danger ? `
            <div class="streak-danger">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Streak at risk!
            </div>
          ` : ''}
        </div>

        ${streak.streak_in_danger ? `
          <button class="btn btn-rescue btn-block" id="rescueBtn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
            Rescue Streak (${streak.rescues_remaining} left)
          </button>
        ` : ''}

        <div class="rescues-display">
          <span class="rescues-label">Rescues this month:</span>
          <div class="rescues-dots">
            ${Array.from({length: 5}, (_, i) => `<div class="rescue-dot ${i < streak.rescues_remaining ? 'active' : 'used'}"></div>`).join('')}
          </div>
        </div>

        ${streak.days_to_next_stage > 0 ? `
          <div class="stage-progress">
            <div class="stage-progress-header">
              <span class="stage-progress-label">Next: ${stageNames[Math.min(streak.penguin_stage + 1, 4)]}</span>
              <span class="stage-progress-count">${streak.days_to_next_stage} days</span>
            </div>
            <div class="stage-progress-bar">
              <div class="stage-progress-fill" style="--progress: ${Math.max(0, 100 - (streak.days_to_next_stage / (streak.penguin_stage === 0 ? 10 : streak.penguin_stage === 1 ? 20 : streak.penguin_stage === 2 ? 30 : 30)) * 100)}%"></div>
            </div>
          </div>
        ` : `
          <div class="stage-progress stage-complete">
            <div class="stage-progress-header">
              <span class="stage-progress-label">Maximum stage reached!</span>
            </div>
          </div>
        `}

        <div class="calendar-section">
          <div class="calendar-header">Last 30 Days</div>
          <div class="calendar-grid">
            ${generateCalendarGrid(calendar)}
          </div>
        </div>
      </div>

      <div class="streak-panel" id="trophyPanel">
        <div class="trophy-display">
          ${streak.win_streak > 0 ? `
            <div class="trophy-current">
              ${getTrophySVG(Math.min(streak.trophy_level, 5))}
              <div class="trophy-current-label">Current Win Streak</div>
              <div class="trophy-current-value">${streak.win_streak} win${streak.win_streak !== 1 ? 's' : ''}</div>
              <div class="trophy-level-badge level-${Math.min(streak.trophy_level, 5)}">Level ${streak.trophy_level}</div>
            </div>
          ` : `
            <div class="trophy-empty">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
              <div>No active win streak</div>
              <div class="trophy-empty-hint">Win a bet to start your streak!</div>
            </div>
          `}
        </div>

        <div class="trophy-stats">
          <div class="trophy-stat">
            <div class="trophy-stat-value">${streak.win_streak}</div>
            <div class="trophy-stat-label">Current</div>
          </div>
          <div class="trophy-stat">
            <div class="trophy-stat-value">${streak.best_win_streak}</div>
            <div class="trophy-stat-label">Best</div>
          </div>
          <div class="trophy-stat">
            <div class="trophy-stat-value">${streak.trophy_level}</div>
            <div class="trophy-stat-label">Level</div>
          </div>
        </div>

        <div class="trophy-levels">
          <div class="trophy-levels-title">Trophy Levels</div>
          ${[1,2,3,4,5].map(level => `
            <div class="trophy-level-item ${level <= streak.trophy_level ? 'achieved' : ''} ${level === streak.trophy_level ? 'current' : ''}">
              <div class="trophy-level-icon">${getTrophySVG(level)}</div>
              <div class="trophy-level-info">
                <div class="trophy-level-name">Level ${level} ${level === 5 ? '(Golden)' : ''}</div>
                <div class="trophy-level-req">${level <= 4 ? `${level} consecutive win${level > 1 ? 's' : ''}` : '5+ consecutive wins'}</div>
              </div>
              <div class="trophy-level-status">
                ${level < streak.trophy_level ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-tertiary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>` :
                  level === streak.trophy_level ? `<span class="trophy-level-current-badge">Current</span>` :
                  `<span class="trophy-level-locked">Locked</span>`}
              </div>
            </div>
          `).join('')}
        </div>

        <div class="trophy-bonus-info">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span>Each win in a streak earns bonus points: streak × 10 pts</span>
        </div>
      </div>
    `;

    attachStreakModalListeners(streak);
  } catch (error) {
    container.innerHTML = '<div class="error">Failed to load streak data</div>';
  }
}

function generateCalendarGrid(calendar) {
  const today = new Date();
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const loggedIn = calendar.some(c => c.login_date === dateStr);
    const isToday = i === 0;
    days.push(`<div class="calendar-day ${loggedIn ? 'logged-in' : 'missed'} ${isToday ? 'today' : ''}" title="${dateStr}">
      ${loggedIn ? `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
    </div>`);
  }
  return days.join('');
}

export function attachStreakModalListeners() {
  const closeBtn = document.getElementById('closeStreakModal');
  if (!closeBtn) return;

  closeBtn.onclick = closeStreakModal;

  const modal = document.getElementById('streakModal');
  if (!modal) return;
  
  modal.onclick = (e) => {
    if (e.target === modal) closeStreakModal();
  };

  document.querySelectorAll('.streak-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.streak-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.streak-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`${tab.dataset.tab}Panel`).classList.add('active');
    };
  });

  const rescueBtn = document.getElementById('rescueBtn');
  if (rescueBtn) {
    rescueBtn.onclick = async () => {
      try {
        const result = await useRescue();
        if (result.success) {
          await loadStreakModal();
        } else {
          alert(result.message);
        }
      } catch (error) {
        alert(error.message || 'Failed to use rescue');
      }
    };
  }
}

export function renderStreakModal() {
  return `
    <div class="modal-overlay" id="streakModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Streaks & Achievements</h2>
          <button class="close-btn" id="closeStreakModal" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div id="streakContent"></div>
      </div>
    </div>
  `;
}
