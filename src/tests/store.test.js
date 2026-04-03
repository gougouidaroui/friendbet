import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/supabase.js', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn()
    },
    from: vi.fn(),
    rpc: vi.fn(),
    channel: vi.fn()
  }
}));

describe('Store', () => {
  let store;
  let getState;
  let subscribe;
  let updateState;
  let updateUser;
  let updateBets;
  let setLoading;
  let setCurrentTab;

  beforeEach(async () => {
    vi.resetModules();
    const module = await import('@/lib/store.js');
    store = module;
    getState = module.getState;
    subscribe = module.subscribe;
    updateState = module.updateState;
    updateUser = module.updateUser;
    updateBets = module.updateBets;
    setLoading = module.setLoading;
    setCurrentTab = module.setCurrentTab;
  });

  describe('getState', () => {
    it('should return initial state', () => {
      const state = getState();
      
      expect(state).toHaveProperty('user');
      expect(state).toHaveProperty('profile');
      expect(state).toHaveProperty('bets');
      expect(state).toHaveProperty('notifications');
      expect(state).toHaveProperty('unreadCount');
      expect(state).toHaveProperty('loading');
      expect(state).toHaveProperty('currentTab');
      expect(state).toHaveProperty('currentFilter');
    });

    it('should have correct initial values', () => {
      const state = getState();
      
      expect(state.user).toBeNull();
      expect(state.profile).toBeNull();
      expect(state.bets).toEqual([]);
      expect(state.notifications).toEqual([]);
      expect(state.unreadCount).toBe(0);
      expect(state.loading).toBe(true);
      expect(state.currentTab).toBe('feed');
      expect(state.currentFilter).toBe('all');
    });
  });

  describe('subscribe', () => {
    it('should call subscriber when state changes', () => {
      const callback = vi.fn();
      const unsubscribe = subscribe(callback);
      
      updateState({ user: { id: 'test' } });
      
      expect(callback).toHaveBeenCalledTimes(1);
      
      unsubscribe();
      
      updateState({ profile: { username: 'test' } });
      
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = subscribe(callback);
      
      expect(typeof unsubscribe).toBe('function');
      
      unsubscribe();
      updateState({ loading: false });
      
      expect(callback).toHaveBeenCalledTimes(0);
    });
  });

  describe('updateState', () => {
    it('should update state with partial changes', () => {
      updateState({ loading: false, currentTab: 'mybets' });
      
      const state = getState();
      expect(state.loading).toBe(false);
      expect(state.currentTab).toBe('mybets');
    });

    it('should notify all subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      subscribe(callback1);
      subscribe(callback2);
      
      updateState({ currentFilter: 'friends' });
      
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateUser', () => {
    it('should update user and profile', () => {
      const user = { id: 'user-1', email: 'test@example.com' };
      const profile = { id: 'user-1', username: 'testuser', points: 5000 };
      
      updateUser(user, profile);
      
      const state = getState();
      expect(state.user).toEqual(user);
      expect(state.profile).toEqual(profile);
    });

    it('should set both to null when called with nulls', () => {
      updateUser(null, null);
      
      const state = getState();
      expect(state.user).toBeNull();
      expect(state.profile).toBeNull();
    });
  });

  describe('setLoading', () => {
    it('should set loading state', () => {
      setLoading(false);
      expect(getState().loading).toBe(false);
      
      setLoading(true);
      expect(getState().loading).toBe(true);
    });
  });

  describe('setCurrentTab', () => {
    it('should set current tab', () => {
      setCurrentTab('mybets');
      expect(getState().currentTab).toBe('mybets');
      
      setCurrentTab('drafts');
      expect(getState().currentTab).toBe('drafts');
    });
  });
});
