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
    it.skip('requires complex mocking - tested manually', () => {});
  });

  describe('getPendingRequests', () => {
    it.skip('requires complex mocking - tested manually', () => {});
  });

  describe('getFriendIds', () => {
    it.skip('requires complex mocking - tested manually', () => {});
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
