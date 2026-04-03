import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase.js', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
    from: vi.fn(),
    rpc: vi.fn(),
    channel: vi.fn(),
  },
}));

describe('Store with Streak', () => {
  let store;
  let getState;
  let subscribe;
  let updateState;
  let updateStreak;
  let updateUser;

  beforeEach(async () => {
    vi.resetModules();
    const module = await import('@/lib/store.js');
    store = module;
    getState = module.getState;
    subscribe = module.subscribe;
    updateState = module.updateState;
    updateStreak = module.updateStreak;
    updateUser = module.updateUser;
  });

  describe('initial state', () => {
    it('should have streak property set to null', () => {
      const state = getState();
      expect(state).toHaveProperty('streak');
      expect(state.streak).toBeNull();
    });
  });

  describe('updateStreak', () => {
    it('should update streak data', () => {
      const streakData = {
        login_streak: 15,
        penguin_stage: 1,
        win_streak: 3,
        best_win_streak: 5,
        trophy_level: 3,
        rescues_remaining: 4,
        streak_in_danger: false,
        days_to_next_stage: 15,
      };

      updateStreak(streakData);

      const state = getState();
      expect(state.streak).toEqual(streakData);
    });

    it('should notify subscribers when streak changes', () => {
      const callback = vi.fn();
      subscribe(callback);

      updateStreak({ login_streak: 10, penguin_stage: 1 });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0].streak).toEqual({ login_streak: 10, penguin_stage: 1 });
    });

    it('should set streak to null', () => {
      updateStreak({ login_streak: 5 });
      updateStreak(null);

      expect(getState().streak).toBeNull();
    });
  });

  describe('streak in full state', () => {
    it('should preserve streak when updating user', () => {
      const streakData = { login_streak: 20, penguin_stage: 2 };
      updateStreak(streakData);

      updateUser({ id: 'user-1' }, { username: 'test', points: 5000 });

      const state = getState();
      expect(state.streak).toEqual(streakData);
      expect(state.user).toEqual({ id: 'user-1' });
    });

    it('should preserve user when updating streak', () => {
      updateUser({ id: 'user-1' }, { username: 'test', points: 5000 });

      updateStreak({ login_streak: 30, penguin_stage: 2 });

      const state = getState();
      expect(state.user).toEqual({ id: 'user-1' });
      expect(state.streak.login_streak).toBe(30);
    });
  });
});
