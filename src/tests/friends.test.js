import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null })
      })),
      or: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({ data: [], error: null })
        }))
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
  channel: vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() })
  })
};

vi.mock('@/lib/supabase.js', () => ({
  supabase: mockSupabase
}));

describe('Friends Service', () => {
  let friends;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
    const { clear } = await import('@/lib/cache.js');
    clear();
    friends = await import('@/services/friends.js');
  });

  describe('sendFriendRequest', () => {
    it('should call rpc with correct params', async () => {
      await friends.sendFriendRequest('user-456');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('send_friend_request', {
        p_addressee_id: 'user-456'
      });
    });

    it('should throw error on failure', async () => {
      mockSupabase.rpc.mockResolvedValue({ 
        data: null, 
        error: { message: 'Already friends' } 
      });

      await expect(friends.sendFriendRequest('user-456'))
        .rejects.toThrow('Already friends');
    });
  });

  describe('acceptFriendRequest', () => {
    it('should call rpc with correct params', async () => {
      await friends.acceptFriendRequest('friendship-123');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('accept_friend_request', {
        p_friendship_id: 'friendship-123'
      });
    });
  });

  describe('declineFriendRequest', () => {
    it('should call rpc with correct params', async () => {
      await friends.declineFriendRequest('friendship-123');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('decline_friend_request', {
        p_friendship_id: 'friendship-123'
      });
    });
  });

  describe('removeFriend', () => {
    it('should call rpc with correct params', async () => {
      await friends.removeFriend('friendship-123');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('remove_friend', {
        p_friendship_id: 'friendship-123'
      });
    });
  });

  describe('getFriends', () => {
    it('should return mapped friend list for accepted friendships', async () => {
      const mockData = [
        {
          id: 'fs-1',
          requester_id: 'user-1',
          addressee_id: 'user-2',
          status: 'accepted',
          created_at: '2024-01-01',
          requester: { id: 'user-1', username: 'alice' },
          addressee: { id: 'user-2', username: 'bob' }
        }
      ];

      const chainMock = {
        or: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockData, error: null })
      };
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue(chainMock)
      });

      const result = await friends.getFriends('user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('friendships');
      expect(chainMock.or).toHaveBeenCalled();
      expect(chainMock.eq).toHaveBeenCalledWith('status', 'accepted');
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('friendshipId', 'fs-1');
      expect(result[0]).toHaveProperty('username', 'bob');
    });
  });

  describe('getPendingRequests', () => {
    it('should return pending friend requests for user', async () => {
      const mockData = [
        {
          id: 'fs-2',
          created_at: '2024-01-02',
          requester: { id: 'user-3', username: 'charlie' }
        }
      ];

      const eqMock = vi.fn().mockImplementation(() => ({
        eq: vi.fn().mockResolvedValue({ data: mockData, error: null })
      }));
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: eqMock
        })
      });

      const result = await friends.getPendingRequests('user-2');

      expect(mockSupabase.from).toHaveBeenCalledWith('friendships');
      expect(result).toHaveLength(1);
      expect(result[0].requester.username).toBe('charlie');
    });
  });

  describe('getFriendIds', () => {
    it('should return array of friend ids', async () => {
      const mockData = [
        {
          id: 'fs-1',
          status: 'accepted',
          created_at: '2024-01-01',
          requester_id: 'user-1',
          addressee_id: 'user-4',
          requester: { id: 'user-1', username: 'alice' },
          addressee: { id: 'user-4', username: 'dave' }
        }
      ];

      const chainMock = {
        or: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockData, error: null })
      };
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue(chainMock)
      });

      const result = await friends.getFriendIds('user-1');

      expect(result).toEqual(['user-4']);
    });
  });

  describe('subscribeToFriendRequests', () => {
    it('should return channel with subscribe', () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() })
      };
      mockSupabase.channel.mockReturnValue(mockChannel);

      const result = friends.subscribeToFriendRequests('user-1', () => {});

      expect(mockChannel.on).toHaveBeenCalled();
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });
  });
});
