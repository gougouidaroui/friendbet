const state = {
  user: null,
  profile: null,
  bets: [],
  notifications: [],
  unreadCount: 0,
  loading: true,
  currentTab: 'feed',
  currentFilter: 'all',
  streak: null,
};

const subscribers = [];

export function getState() {
  return state;
}

export function subscribe(fn) {
  subscribers.push(fn);
  return () => {
    const index = subscribers.indexOf(fn);
    if (index > -1) {
      subscribers.splice(index, 1);
    }
  };
}

export function updateState(partial) {
  Object.assign(state, partial);
  subscribers.forEach(fn => fn(state));
}

export function updateUser(user, profile) {
  updateState({ user, profile });
}

export function updateBets(bets) {
  updateState({ bets });
}

export function updateNotifications(notifications, unreadCount) {
  updateState({ notifications, unreadCount });
}

export function setLoading(loading) {
  updateState({ loading });
}

export function setCurrentTab(tab) {
  updateState({ currentTab: tab });
}

export function setCurrentFilter(filter) {
  updateState({ currentFilter: filter });
}

export function updateStateSilent(partial) {
  Object.assign(state, partial);
}

export function updateStreak(streak) {
  updateState({ streak });
}
