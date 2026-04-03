import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
const mockChannel = vi.fn(() => ({
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn(),
}));

vi.mock('@/lib/supabase.js', () => ({
  supabase: {
    rpc: mockRpc,
    channel: mockChannel,
  },
}));

describe('Streaks Service', () => {
  let streaks;

  beforeEach(async () => {
    vi.resetModules();
    mockRpc.mockReset();
    mockChannel.mockClear();
    streaks = await import('@/services/streaks.js');
  });

  describe('getStreakData', () => {
    it('should call get_streak_data rpc', async () => {
      const mockResult = {
        login_streak: 15,
        penguin_stage: 1,
        win_streak: 3,
        best_win_streak: 5,
        trophy_level: 3,
        rescues_remaining: 4,
        streak_in_danger: false,
        days_to_next_stage: 15,
      };
      mockRpc.mockResolvedValue({ data: [mockResult], error: null });

      const result = await streaks.getStreakData();

      expect(mockRpc).toHaveBeenCalledWith('get_streak_data');
      expect(result).toEqual(mockResult);
    });

    it('should return null when no data', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await streaks.getStreakData();

      expect(result).toBeNull();
    });

    it('should throw on error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });

      await expect(streaks.getStreakData()).rejects.toEqual({ message: 'RPC failed' });
    });
  });

  describe('useRescue', () => {
    it('should call use_rescue rpc and return result', async () => {
      const mockResult = { success: true, new_streak: 15, message: 'Streak rescued!' };
      mockRpc.mockResolvedValue({ data: [mockResult], error: null });

      const result = await streaks.useRescue();

      expect(mockRpc).toHaveBeenCalledWith('use_rescue');
      expect(result).toEqual(mockResult);
    });

    it('should return failure when no rescues left', async () => {
      const mockResult = { success: false, new_streak: 0, message: 'No rescues remaining' };
      mockRpc.mockResolvedValue({ data: [mockResult], error: null });

      const result = await streaks.useRescue();

      expect(result.success).toBe(false);
      expect(result.message).toBe('No rescues remaining');
    });
  });

  describe('getPenguinCalendar', () => {
    it('should call get_penguin_calendar rpc', async () => {
      const mockDates = [
        { login_date: '2026-04-02' },
        { login_date: '2026-04-01' },
      ];
      mockRpc.mockResolvedValue({ data: mockDates, error: null });

      const result = await streaks.getPenguinCalendar();

      expect(mockRpc).toHaveBeenCalledWith('get_penguin_calendar');
      expect(result).toEqual(mockDates);
    });

    it('should return empty array when no data', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await streaks.getPenguinCalendar();

      expect(result).toEqual([]);
    });
  });

  describe('updateWinStreak', () => {
    it('should call update_win_streak with true', async () => {
      const mockResult = { new_win_streak: 3, best_win_streak: 5, new_trophy_level: 3, points_earned: 30 };
      mockRpc.mockResolvedValue({ data: [mockResult], error: null });

      const result = await streaks.updateWinStreak(true);

      expect(mockRpc).toHaveBeenCalledWith('update_win_streak', { p_won: true });
      expect(result).toEqual(mockResult);
    });

    it('should call update_win_streak with false', async () => {
      const mockResult = { new_win_streak: 0, best_win_streak: 5, new_trophy_level: 0, points_earned: 0 };
      mockRpc.mockResolvedValue({ data: [mockResult], error: null });

      const result = await streaks.updateWinStreak(false);

      expect(mockRpc).toHaveBeenCalledWith('update_win_streak', { p_won: false });
      expect(result).toEqual(mockResult);
    });
  });

  describe('subscribeToStreakChanges', () => {
    it('should create channel with correct filter', () => {
      const callback = vi.fn();
      streaks.subscribeToStreakChanges('user-123', callback);

      expect(mockChannel).toHaveBeenCalledWith('streak_changes');
    });
  });
});
