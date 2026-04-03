import { getState, subscribe, updateUser, setLoading, updateStreak, updateStateSilent } from './lib/store.js';
import { removeAll, has, registerChannel } from './lib/subscriptions.js';
import { onAuthStateChange, loadProfile } from './services/auth.js';
import { getBets, getDrafts, deleteBet, subscribeToBets, getBet, placeWager as placeWagerService } from './services/bets.js';
import { signOut } from './services/auth.js';
import { getStreakData, subscribeToStreakChanges } from './services/streaks.js';

import { renderAuth, attachAuthListeners } from './components/auth.js';
import { renderHeader, updateHeader } from './components/header.js';
import { renderTabs, attachTabsListeners } from './components/tabs.js';
import { renderBetCard, renderWagers, renderEmptyState } from './components/bet-card.js';
import { renderBetModal, openBetModal, attachBetModalListeners } from './components/bet-modal.js';
import { renderWinnerModal, openWinnerModal, attachWinnerModalListeners } from './components/winner-modal.js';
import { renderHistoryModal, openHistoryModal, attachHistoryModalListeners } from './components/history-modal.js';
import { renderAdminModal, openAdminModal, attachAdminModalListeners } from './components/admin-modal.js';
import { renderProfileModal, openProfileModal, attachProfileModalListeners } from './components/profile-modal.js';
import { renderFriendsPanel, openFriendsPanel, attachFriendsPanelListeners } from './components/friends-panel.js';
import { renderNotificationsModal, openNotificationsModal, attachNotificationsModalListeners } from './components/notification-badge.js';
import { renderStreakModal, openStreakModal, attachStreakModalListeners } from './components/streak-modal.js';

let appElement = null;

export function initApp(element) {
  appElement = element;
  
  subscribe(render);
  
  onAuthStateChange(async (event, session) => {
    if ((event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') && session?.user) {
      const { user } = getState();
      if (user?.id === session.user.id) return;
      const profile = await loadProfile(session.user);
      updateUser(session.user, profile);
    } else if (event === 'SIGNED_OUT') {
      removeAll();
      updateUser(null, null);
    }
  });
  
  render();
}

function render() {
  const { user, profile, loading } = getState();
  
  if (loading) {
    appElement.innerHTML = '<div class="loader"></div>';
    return;
  }
  
  if (!user) {
    appElement.innerHTML = renderAuth();
    attachAuthListeners(appElement);
    return;
  }
  
  if (!document.getElementById('appLoadingOverlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'appLoadingOverlay';
    overlay.className = 'app-loading-overlay';
    overlay.innerHTML = `
      <div class="app-loading-content">
        <div class="loader"></div>
        <div class="app-loading-bar"><div class="app-loading-bar-fill" id="appLoadingBarFill"></div></div>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  
  appElement.innerHTML = `
    <div class="app active">
      <div class="container">
        ${renderHeader()}
        ${renderTabs()}
        <button class="fab" id="createBetBtn" title="Create Bet">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
    </div>
    ${renderBetModal()}
    ${renderWinnerModal()}
    ${renderHistoryModal()}
    ${renderAdminModal()}
    ${renderProfileModal()}
    ${renderFriendsPanel()}
    ${renderNotificationsModal()}
    ${renderStreakModal()}
  `;
  
  attachHeaderListeners();
  attachTabsListeners(appElement, onTabChange);
  attachBetModalListeners();
  attachWinnerModalListeners();
  attachHistoryModalListeners();
  attachAdminModalListeners();
  attachProfileModalListeners();
  attachFriendsPanelListeners();
  attachNotificationsModalListeners();
  attachStreakModalListeners();
  
  document.getElementById('createBetBtn').onclick = () => openBetModal(null, loadCurrentTab);
  
  loadCurrentTab().finally(() => {
    const barFill = document.getElementById('appLoadingBarFill');
    if (barFill) barFill.style.width = '100%';
    setTimeout(() => {
      const overlay = document.getElementById('appLoadingOverlay');
      if (overlay) overlay.remove();
    }, 400);
  });
  
  setupSubscriptions();
}

function setupSubscriptions() {
  const { user } = getState();
  if (!user) return;
  
  if (!has('bets_changes')) {
    loadStreakData();
    const channel = subscribeToBets(async () => {
      await loadCurrentTab();
    });
    registerChannel('bets_changes', channel);
  }
  
  if (!has('streak_changes')) {
    const channel = subscribeToStreakChanges(user.id, (newProfile) => {
      const streakData = {
        login_streak: newProfile.out_login_streak ?? newProfile.login_streak ?? 0,
        penguin_stage: newProfile.out_penguin_stage ?? newProfile.penguin_stage ?? 0,
        win_streak: newProfile.out_win_streak ?? newProfile.win_streak ?? 0,
        best_win_streak: newProfile.out_best_win_streak ?? newProfile.best_win_streak ?? 0,
        trophy_level: newProfile.out_trophy_level ?? newProfile.trophy_level ?? 0,
        rescues_remaining: newProfile.out_rescues_remaining ?? newProfile.rescues_remaining ?? 0,
        streak_in_danger: newProfile.out_streak_in_danger ?? newProfile.streak_in_danger ?? false,
        days_to_next_stage: newProfile.out_days_to_next_stage ?? newProfile.days_to_next_stage ?? 0,
      };
      updateStateSilent({ streak: streakData });
      updateHeader();
    });
    registerChannel('streak_changes', channel);
  }
}

async function loadCurrentTab() {
  const { currentTab } = getState();
  
  switch (currentTab) {
    case 'feed':
      await loadFeed();
      break;
    case 'mybets':
      await loadMyBets();
      break;
    case 'drafts':
      await loadDrafts();
      break;
  }
}

async function onTabChange(tab) {
  loadCurrentTab();
}

async function loadFeed() {
  const container = document.getElementById('feedContent');
  const { user } = getState();
  
  container.innerHTML = '<div class="loader"></div>';
  
  try {
    const bets = await getBets(user.id, 'all');
    
    if (bets.length === 0) {
      container.innerHTML = renderEmptyState('bet', 'No bets yet', 'Create the first bet and challenge your friends!');
    } else {
      container.innerHTML = bets.map(bet => renderBetCard(bet, 'feed')).join('');
    }
    
    attachBetCardListeners();
  } catch (error) {
    container.innerHTML = '<div class="error">Failed to load bets</div>';
  }
}

async function loadMyBets() {
  const container = document.getElementById('mybetsContent');
  const { user } = getState();
  
  container.innerHTML = '<div class="loader"></div>';
  
  try {
    const bets = await getBets(user.id, 'mybets');
    
    if (bets.length === 0) {
      container.innerHTML = renderEmptyState('shield', 'No active bets', 'Join a bet from the feed to get started!');
    } else {
      container.innerHTML = bets.map(bet => renderBetCard(bet, 'mybets')).join('');
    }
    
    attachBetCardListeners();
  } catch (error) {
    container.innerHTML = '<div class="error">Failed to load bets</div>';
  }
}

async function loadDrafts() {
  const container = document.getElementById('draftsContent');
  const { user } = getState();
  
  container.innerHTML = '<div class="loader"></div>';
  
  try {
    const drafts = await getDrafts(user.id);
    
    if (drafts.length === 0) {
      container.innerHTML = renderEmptyState('edit', 'No drafts', 'Save a bet as draft to edit it later!');
    } else {
      container.innerHTML = drafts.map(bet => renderBetCard(bet, 'drafts')).join('');
    }
    
    attachBetCardListeners();
  } catch (error) {
    container.innerHTML = '<div class="error">Failed to load drafts</div>';
  }
}

function attachBetCardListeners() {
  const { user } = getState();
  
  document.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.onclick = () => {
      const betId = btn.dataset.betId;
      openBetModal(betId, loadCurrentTab);
    };
  });
  
  document.querySelectorAll('[data-action="publish"]').forEach(btn => {
    btn.onclick = async () => {
      const betId = btn.dataset.betId;
      try {
        const { publishBet } = await import('./services/bets.js');
        await publishBet(betId);
        const profile = await loadProfile(user);
        updateUser(user, profile);
        loadCurrentTab();
      } catch (error) {
        alert(error.message || 'Failed to publish bet');
      }
    };
  });
  
  document.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.onclick = async () => {
      const betId = btn.dataset.betId;
      if (!confirm('Delete this bet?')) return;
      try {
        await deleteBet(betId);
        loadCurrentTab();
      } catch (error) {
        alert(error.message || 'Failed to delete bet');
      }
    };
  });
  
  document.querySelectorAll('[data-action="bet-for"], [data-action="bet-against"]').forEach(btn => {
    btn.onclick = async () => {
      const betId = btn.dataset.betId;
      const side = btn.dataset.action === 'bet-for' ? 'for' : 'against';
      const amount = prompt(`Enter your stake for "${side}" side:`);
      
      if (!amount || isNaN(parseInt(amount)) || parseInt(amount) <= 0) return;
      
      const wagerAmount = parseInt(amount);
      
      try {
        const { placeWager } = await import('./services/bets.js');
        const { loadProfile } = await import('./services/auth.js');
        await placeWager(betId, user.id, side, wagerAmount);
        const profile = await loadProfile(user);
        updateUser(user, profile);
        loadCurrentTab();
      } catch (error) {
        alert(error.message || 'Failed to place wager');
      }
    };
  });
  
  document.querySelectorAll('[data-action="select-winner"]').forEach(btn => {
    btn.onclick = () => {
      const betId = btn.dataset.betId;
      openWinnerModal(betId, loadCurrentTab);
    };
  });
  
  document.querySelectorAll('[data-action="reveal-wagers"]').forEach(btn => {
    btn.onclick = async () => {
      const betId = btn.dataset.betId;
      const container = document.getElementById(`wagers-${betId}`);
      
      if (container.style.display === 'none') {
        container.style.display = 'grid';
        btn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          Hide who bet
        `;
        await renderWagers(betId, container);
      } else {
        container.style.display = 'none';
        btn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          Reveal who bet
        `;
      }
    };
  });
}

function attachHeaderListeners() {
  const { user, profile } = getState();
  
  document.getElementById('headerAvatar').onclick = () => openProfileModal(user.id);
  document.querySelector('.user-info h3').onclick = () => openProfileModal(user.id);
  
  document.getElementById('streakBtn').onclick = () => openStreakModal();
  document.getElementById('notificationsBtn').onclick = () => openNotificationsModal();
  document.getElementById('friendsBtn').onclick = () => openFriendsPanel();
  document.getElementById('historyBtn').onclick = () => openHistoryModal();
  
  if (profile?.is_admin) {
    document.getElementById('adminBtn').onclick = () => openAdminModal();
  }
  
  document.getElementById('logoutBtn').onclick = async () => {
    await signOut();
  };
}

async function loadStreakData() {
  try {
    const { user } = getState();
    if (!user) return;
    const raw = await getStreakData();
    if (!raw) return;
    updateStreak({
      login_streak: raw.out_login_streak ?? raw.login_streak ?? 0,
      penguin_stage: raw.out_penguin_stage ?? raw.penguin_stage ?? 0,
      win_streak: raw.out_win_streak ?? raw.win_streak ?? 0,
      best_win_streak: raw.out_best_win_streak ?? raw.best_win_streak ?? 0,
      trophy_level: raw.out_trophy_level ?? raw.trophy_level ?? 0,
      rescues_remaining: raw.out_rescues_remaining ?? raw.rescues_remaining ?? 0,
      streak_in_danger: raw.out_streak_in_danger ?? raw.streak_in_danger ?? false,
      days_to_next_stage: raw.out_days_to_next_stage ?? raw.days_to_next_stage ?? 0,
    });
  } catch (e) {
    console.log('Could not load streak data');
  }
}

export async function updateUserProfile(partial) {
  const { profile, user } = getState();
  updateUser(user, { ...profile, ...partial });
  updateHeader();
}
