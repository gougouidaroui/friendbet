import { getState, subscribe, updateUser, setLoading, updateStreak, updateStateSilent } from './lib/store.js';
import { removeAll, has, registerChannel } from './lib/subscriptions.js';
import { onAuthStateChange, loadProfile } from './services/auth.js';
import { getBets, getDrafts, deleteBet, subscribeToBets, getBet, placeWager as placeWagerService, autoExpireBets } from './services/bets.js';
import { signOut } from './services/auth.js';
import { getStreakData, subscribeToStreakChanges } from './services/streaks.js';
import { clear as clearCache, invalidate as invalidateCache } from './lib/cache.js';

import { renderAuth, attachAuthListeners } from './components/auth.js';
import { renderHeader, updateHeader } from './components/header.js';
import { renderTabs, attachTabsListeners } from './components/tabs.js';
import { renderBetCard, renderWagers, renderEmptyState } from './components/bet-card.js';
import { openBetModal } from './components/bet-modal.js';

let appElement = null;
let isFirstRender = true;
let modalRegistry = {};

export function initApp(element) {
  appElement = element;
  
  subscribe(render);
  
  onAuthStateChange(async (event, session) => {
    if ((event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') && session?.user) {
      const { user } = getState();
      if (user?.id === session.user.id) return;
      
      if (!document.getElementById('appLoadingOverlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'appLoadingOverlay';
        overlay.className = 'app-loading-overlay';
        overlay.innerHTML = `
          <div class="app-loading-content">
            <div class="app-loading-status" id="appLoadingStatus">Signing in...</div>
            <div class="app-loading-bar"><div class="app-loading-bar-fill" id="appLoadingBarFill" style="width:30%"></div></div>
          </div>
        `;
        document.body.appendChild(overlay);
      }
      
      const profile = await loadProfile(session.user);
      updateUser(session.user, profile);
    } else if (event === 'SIGNED_OUT') {
      removeAll();
      clearCache();
      modalRegistry = {};
      isFirstRender = true;
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
    const overlay = document.getElementById('appLoadingOverlay');
    if (overlay) overlay.remove();
    appElement.innerHTML = renderAuth();
    attachAuthListeners(appElement);
    return;
  }
  
  if (isFirstRender) {
    appElement.innerHTML = `
      <main class="app active">
        <div class="container">
          ${renderHeader()}
          ${renderTabs()}
          <button class="fab" id="createBetBtn" title="Create Bet">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </main>
    `;
    
    attachHeaderListeners();
    attachTabsListeners(appElement, onTabChange);
    
    document.getElementById('createBetBtn').onclick = () => lazyModal('bet', () => openBetModal(null, loadCurrentTab));
    
    loadCurrentTab().finally(() => {
      const status = document.getElementById('appLoadingStatus');
      if (status) status.textContent = 'Almost there...';
      const barFill = document.getElementById('appLoadingBarFill');
      if (barFill) barFill.style.width = '100%';
      setTimeout(() => {
        const overlay = document.getElementById('appLoadingOverlay');
        if (overlay) overlay.remove();
      }, 400);
    });
    
    setupSubscriptions();
    isFirstRender = false;
  }
}

function updateTabContent(tab, bets, context) {
  const container = document.getElementById(`${tab}Content`);
  if (!container) return;
  
  if (bets.length === 0) {
    const icon = tab === 'feed' ? 'bet' : tab === 'mybets' ? 'shield' : 'edit';
    const title = tab === 'feed' ? 'No bets yet' : tab === 'mybets' ? 'No active bets' : 'No drafts';
    const desc = tab === 'feed' ? 'Create the first bet and challenge your friends!' : tab === 'mybets' ? 'Join a bet from the feed to get started!' : 'Save a bet as draft to edit it later!';
    container.innerHTML = renderEmptyState(icon, title, desc);
  } else {
    container.innerHTML = bets.map(bet => renderBetCard(bet, context)).join('');
  }
  
  attachBetCardListeners();
}

async function lazyModal(name, action) {
  if (!modalRegistry[name]) {
    switch (name) {
      case 'bet': {
        const { renderBetModal, openBetModal, attachBetModalListeners } = await import('./components/bet-modal.js');
        document.body.insertAdjacentHTML('beforeend', renderBetModal());
        attachBetModalListeners();
        modalRegistry[name] = { openBetModal };
        break;
      }
      case 'winner': {
        const { renderWinnerModal, openWinnerModal, attachWinnerModalListeners } = await import('./components/winner-modal.js');
        document.body.insertAdjacentHTML('beforeend', renderWinnerModal());
        attachWinnerModalListeners();
        modalRegistry[name] = { openWinnerModal };
        break;
      }
      case 'history': {
        const { renderHistoryModal, openHistoryModal, attachHistoryModalListeners } = await import('./components/history-modal.js');
        document.body.insertAdjacentHTML('beforeend', renderHistoryModal());
        attachHistoryModalListeners();
        modalRegistry[name] = { openHistoryModal };
        break;
      }
      case 'admin': {
        const { renderAdminModal, openAdminModal, attachAdminModalListeners } = await import('./components/admin-modal.js');
        document.body.insertAdjacentHTML('beforeend', renderAdminModal());
        attachAdminModalListeners();
        modalRegistry[name] = { openAdminModal };
        break;
      }
      case 'profile': {
        const { renderProfileModal, openProfileModal, attachProfileModalListeners } = await import('./components/profile-modal.js');
        document.body.insertAdjacentHTML('beforeend', renderProfileModal());
        attachProfileModalListeners();
        modalRegistry[name] = { openProfileModal };
        break;
      }
      case 'friends': {
        const { renderFriendsPanel, openFriendsPanel, attachFriendsPanelListeners } = await import('./components/friends-panel.js');
        document.body.insertAdjacentHTML('beforeend', renderFriendsPanel());
        attachFriendsPanelListeners();
        modalRegistry[name] = { openFriendsPanel };
        break;
      }
      case 'notifications': {
        const { renderNotificationsModal, openNotificationsModal, attachNotificationsModalListeners } = await import('./components/notification-badge.js');
        document.body.insertAdjacentHTML('beforeend', renderNotificationsModal());
        attachNotificationsModalListeners();
        modalRegistry[name] = { openNotificationsModal };
        break;
      }
      case 'streak': {
        const { renderStreakModal, openStreakModal, attachStreakModalListeners } = await import('./components/streak-modal.js');
        document.body.insertAdjacentHTML('beforeend', renderStreakModal());
        attachStreakModalListeners();
        modalRegistry[name] = { openStreakModal };
        break;
      }
      case 'wager': {
        const { renderWagerModal, openWagerModal, attachWagerModalListeners } = await import('./components/wager-modal.js');
        document.body.insertAdjacentHTML('beforeend', renderWagerModal());
        attachWagerModalListeners();
        modalRegistry[name] = { openWagerModal };
        break;
      }
      case 'court': {
        const { renderCourtModal, openCourtModal, attachCourtModalListeners } = await import('./components/court-modal.js');
        document.body.insertAdjacentHTML('beforeend', renderCourtModal());
        attachCourtModalListeners();
        modalRegistry[name] = { openCourtModal };
        break;
      }
    }
  }
  return action();
}

function setupSubscriptions() {
  const { user } = getState();
  if (!user) return;
  
  if (!has('bets_changes')) {
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
    const expiredIds = await autoExpireBets(bets);
    
    if (expiredIds.size > 0) {
      const updatedBets = bets.map(bet => {
        if (expiredIds.has(bet.id)) {
          return { ...bet, status: 'refunded' };
        }
        return bet;
      });
      updateTabContent('feed', updatedBets, 'feed');
    } else {
      updateTabContent('feed', bets, 'feed');
    }
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
    const expiredIds = await autoExpireBets(bets);
    
    if (expiredIds.size > 0) {
      const updatedBets = bets.map(bet => {
        if (expiredIds.has(bet.id)) {
          return { ...bet, status: 'refunded' };
        }
        return bet;
      });
      updateTabContent('mybets', updatedBets, 'mybets');
    } else {
      updateTabContent('mybets', bets, 'mybets');
    }
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
    updateTabContent('drafts', drafts, 'drafts');
  } catch (error) {
    container.innerHTML = '<div class="error">Failed to load drafts</div>';
  }
}

function attachBetCardListeners() {
  const { user } = getState();
  
  document.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.onclick = () => {
      const betId = btn.dataset.betId;
      lazyModal('bet', () => {
        const { openBetModal } = modalRegistry.bet;
        openBetModal(betId, loadCurrentTab);
      });
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
        invalidateCache('friends');
        invalidateCache('friendIds');
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
      const betCard = btn.closest('.bet-card');
      const betTitle = betCard?.querySelector('.bet-title')?.textContent || '';
      lazyModal('wager', () => {
        const { openWagerModal } = modalRegistry.wager;
        openWagerModal(betId, side, betTitle, loadCurrentTab);
      });
    };
  });
  
  document.querySelectorAll('[data-action="select-winner"]').forEach(btn => {
    btn.onclick = () => {
      const betId = btn.dataset.betId;
      lazyModal('winner', () => {
        const { openWinnerModal } = modalRegistry.winner;
        openWinnerModal(betId, loadCurrentTab);
      });
    };
  });

  document.querySelectorAll('[data-action="open-court"]').forEach(btn => {
    btn.onclick = () => {
      const betId = btn.dataset.betId;
      lazyModal('court', () => {
        const { openCourtModal } = modalRegistry.court;
        openCourtModal(betId, loadCurrentTab);
      });
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
          Hide the Shame
        `;
        await renderWagers(betId, container);
      } else {
        container.style.display = 'none';
        btn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          Public Shaming
        `;
      }
    };
  });
}

function attachHeaderListeners() {
  const { user, profile } = getState();
  
  document.getElementById('headerAvatar').onclick = () => lazyModal('profile', () => {
    const { openProfileModal } = modalRegistry.profile;
    openProfileModal(user.id);
  });
  document.querySelector('.user-info h3').onclick = () => lazyModal('profile', () => {
    const { openProfileModal } = modalRegistry.profile;
    openProfileModal(user.id);
  });
  
  document.getElementById('streakBtn').onclick = () => lazyModal('streak', () => {
    const { openStreakModal } = modalRegistry.streak;
    openStreakModal();
  });
  document.getElementById('notificationsBtn').onclick = () => lazyModal('notifications', () => {
    const { openNotificationsModal } = modalRegistry.notifications;
    openNotificationsModal();
  });
  document.getElementById('friendsBtn').onclick = () => lazyModal('friends', () => {
    const { openFriendsPanel } = modalRegistry.friends;
    openFriendsPanel();
  });
  document.getElementById('historyBtn').onclick = () => lazyModal('history', () => {
    const { openHistoryModal } = modalRegistry.history;
    openHistoryModal();
  });
  
  if (profile?.is_admin) {
    document.getElementById('adminBtn').onclick = () => lazyModal('admin', () => {
      const { openAdminModal } = modalRegistry.admin;
      openAdminModal();
    });
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
