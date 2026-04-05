import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() })
};

const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        contains: vi.fn().mockResolvedValue({ data: [], error: null })
      })),
      or: vi.fn(() => ({
        order: vi.fn().mockResolvedValue({ data: [], error: null })
      }))
    })),
    insert: vi.fn(() => ({
      single: vi.fn().mockResolvedValue({ data: null, error: null })
    })),
    update: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null })
    })),
    delete: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null })
    }))
  })),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  channel: vi.fn().mockReturnValue(mockChannel)
};

vi.mock('@/lib/supabase.js', () => ({
  supabase: mockSupabase
}));

vi.mock('@/services/friends.js', () => ({
  getFriendIds: vi.fn().mockResolvedValue(['friend-1', 'friend-2']),
  getFriends: vi.fn().mockResolvedValue([
    { id: 'friend-1', username: 'alice' },
    { id: 'friend-2', username: 'bob' }
  ])
}));

describe('Bets Service', () => {
  let bets;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          order: vi.fn().mockResolvedValue({ data: [], error: null })
        }))
      }))
    });
    bets = await import('@/services/bets.js');
  });

  describe('createBet', () => {
    it('should call rpc with correct params for draft', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 'bet-123', error: null });

      const result = await bets.createBet({
        title: 'Test Bet',
        description: 'Description',
        duration: 24,
        stake: 100,
        visibility: 'public'
      }, 'user-123', false);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_bet', {
        p_title: 'Test Bet',
        p_description: 'Description',
        p_duration: 24,
        p_stake: 100,
        p_visibility: 'public',
        p_publish: false
      });
      expect(result).toEqual({ id: 'bet-123' });
    });

    it('should call rpc with correct params for published', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 'bet-123', error: null });
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { points: 5000 }, error: null })
          }))
        }))
      });

      const result = await bets.createBet({
        title: 'Test Bet',
        duration: 24
      }, 'user-123', true);

      expect(result).toHaveProperty('id', 'bet-123');
      expect(result).toHaveProperty('points');
    });

    it('should throw error on failure', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'Failed' } });

      await expect(bets.createBet({ title: 'Test' }, 'user-123', false))
        .rejects.toThrow('Failed');
    });
  });

  describe('placeWager', () => {
    it('should call rpc with correct params', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { points: 4900 }, error: null })
          }))
        }))
      });

      await bets.placeWager('bet-123', 'user-123', 'for', 100);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('place_wager', {
        p_bet_id: 'bet-123',
        p_side: 'for',
        p_amount: 100
      });
    });

    it('should return updated points', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { points: 4500 }, error: null })
          }))
        }))
      });

      const result = await bets.placeWager('bet-123', 'user-123', 'against', 500);

      expect(result).toBe(4500);
    });
  });

  describe('resolveBet', () => {
    it('should call rpc with correct params', async () => {
      await bets.resolveBet('bet-123', 'for', 'user-123');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('resolve_bet', {
        p_bet_id: 'bet-123',
        p_winner: 'for'
      });
    });

    it('should throw error on failure', async () => {
      mockSupabase.rpc.mockResolvedValue({ 
        data: null, 
        error: { message: 'Not authorized' } 
      });

      await expect(bets.resolveBet('bet-123', 'for', 'user-123'))
        .rejects.toThrow('Not authorized');
    });
  });

  describe('deleteBet', () => {
    it('should call rpc with correct params', async () => {
      await bets.deleteBet('bet-123');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('delete_bet', {
        p_bet_id: 'bet-123'
      });
    });
  });

  describe('publishBet', () => {
    it('should call rpc with correct params', async () => {
      await bets.publishBet('bet-123');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('publish_bet', {
        p_bet_id: 'bet-123'
      });
    });
  });

  describe('getBets', () => {
    it('should return filtered bets for feed', async () => {
      const mockBets = [
        {
          id: 'bet-1',
          title: 'Public Bet',
          status: 'published',
          visibility: 'public',
          creator_id: 'other-user',
          creator: { id: 'other-user', username: 'alice' },
          wagers: [{ id: 'w1', user_id: 'other-user', side: 'for', amount: 100 }]
        },
        {
          id: 'bet-2',
          title: 'My Bet',
          status: 'published',
          visibility: 'friends',
          creator_id: 'user-123',
          creator: { id: 'user-123', username: 'me' },
          wagers: []
        }
      ];

      const queryMock = {
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockBets, error: null })
      };
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue(queryMock)
      });

      const result = await bets.getBets('user-123', 'feed');

      expect(mockSupabase.from).toHaveBeenCalledWith('bets');
      expect(queryMock.in).toHaveBeenCalledWith('status', ['published', 'in_resolution', 'resolved', 'refunded']);
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Public Bet');
      expect(result[1].title).toBe('My Bet');
    });

    it('should filter to only user bets for mybets', async () => {
      const mockBets = [
        {
          id: 'bet-1',
          title: 'Bet I joined',
          status: 'published',
          visibility: 'public',
          creator_id: 'other-user',
          creator: { id: 'other-user', username: 'alice' },
          wagers: [{ id: 'w1', user_id: 'user-123', side: 'for', amount: 100 }]
        },
        {
          id: 'bet-2',
          title: 'Bet I did not join',
          status: 'published',
          visibility: 'public',
          creator_id: 'other-user',
          creator: { id: 'other-user', username: 'alice' },
          wagers: [{ id: 'w2', user_id: 'other-user', side: 'for', amount: 50 }]
        }
      ];

      const queryMock = {
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockBets, error: null })
      };
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue(queryMock)
      });

      const result = await bets.getBets('user-123', 'mybets');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Bet I joined');
    });
  });

  describe('subscribeToBets', () => {
    it('should return channel with subscribe', () => {
      const result = bets.subscribeToBets(() => {});

      expect(mockSupabase.channel).toHaveBeenCalled();
      expect(mockChannel.on).toHaveBeenCalled();
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });
  });
});
