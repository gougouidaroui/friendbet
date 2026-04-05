import './index.css';
import { initApp } from './app.js';
import { getCurrentUser, loadProfile } from './services/auth.js';
import { getStreakData } from './services/streaks.js';
import { updateUser, setLoading, updateStreak, getState } from './lib/store.js';
import { renderAdminDashboard, attachAdminDashboardListeners, resetAdminTab } from './components/admin-dashboard.js';
import { loadOverview } from './components/admin-overview.js';
import { loadUsers } from './components/admin-users.js';
import { loadBets } from './components/admin-bets.js';
import { loadLogs } from './components/admin-logs.js';
import { loadCourts } from './components/admin-courts.js';

const app = document.getElementById('app');

function setLoadingStatus(text) {
  const el = document.getElementById('appLoadingStatus');
  if (el) el.textContent = text;
}

function setProgress(pct) {
  const el = document.getElementById('appLoadingBarFill');
  if (el) el.style.width = pct + '%';
}

function removeOverlay() {
  const el = document.getElementById('appLoadingOverlay');
  if (el) {
    setProgress(100);
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 400);
  }
}

const adminTabLoaders = {
  overview: loadOverview,
  users: loadUsers,
  bets: loadBets,
  logs: loadLogs,
  courts: loadCourts,
};

function initAdminDashboard() {
  app.innerHTML = renderAdminDashboard();
  attachAdminDashboardListeners((tab) => {
    const loader = adminTabLoaders[tab];
    if (loader) loader();
  });
  loadOverview();
}

async function start() {
  setLoadingStatus('Connecting...');
  setProgress(10);
  setLoading(true);
  
  const { data: { session } } = await getCurrentUser();
  
  if (session?.user) {
    setLoadingStatus('Signing in...');
    setProgress(30);
    
    try {
      const [profile, streakRaw] = await Promise.allSettled([
        loadProfile(session.user),
        getStreakData(),
      ]);
      
      if (profile.status === 'fulfilled') {
        updateUser(session.user, profile.value);
      } else {
        console.error('Failed to load profile:', profile.reason);
        updateUser(session.user, null);
      }
      
      if (streakRaw.status === 'fulfilled' && streakRaw.value) {
        const sr = streakRaw.value;
        updateStreak({
          login_streak: sr.out_login_streak ?? sr.login_streak ?? 0,
          penguin_stage: sr.out_penguin_stage ?? sr.penguin_stage ?? 0,
          win_streak: sr.out_win_streak ?? sr.win_streak ?? 0,
          best_win_streak: sr.out_best_win_streak ?? sr.best_win_streak ?? 0,
          trophy_level: sr.out_trophy_level ?? sr.trophy_level ?? 0,
          rescues_remaining: sr.out_rescues_remaining ?? sr.rescues_remaining ?? 0,
          streak_in_danger: sr.out_streak_in_danger ?? sr.streak_in_danger ?? false,
          days_to_next_stage: sr.out_days_to_next_stage ?? sr.days_to_next_stage ?? 0,
        });
      }
      
      setProgress(50);
    } catch (error) {
      console.error('Failed to initialize:', error);
      updateUser(session.user, null);
    }
  }
  
  setLoading(false);
  
  if (getState().profile?.is_admin) {
    setLoadingStatus('Loading admin dashboard...');
    setProgress(60);
    resetAdminTab();
    initAdminDashboard();
  } else {
    setLoadingStatus('Loading your bets...');
    setProgress(60);
    initApp(app);
  }
}

start();
