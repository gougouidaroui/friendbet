import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockSupabase = {
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn()
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn()
      }))
    }))
  }))
};

vi.mock('@/lib/supabase.js', () => ({
  supabase: mockSupabase
}));

describe('Auth Service', () => {
  let auth;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    auth = await import('@/services/auth.js');
  });

  describe('signUp', () => {
    it('should call supabase.auth.signUp with correct params', async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: { id: '123' } },
        error: null
      });

      await auth.signUp('test@example.com', 'password123', 'testuser');

      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        options: {
          data: { username: 'testuser' }
        }
      });
    });

    it('should throw error on signUp failure', async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        data: null,
        error: { message: 'Email already exists' }
      });

      await expect(auth.signUp('test@example.com', 'password', 'user'))
        .rejects.toThrow('Email already exists');
    });
  });

  describe('signIn', () => {
    it('should call supabase.auth.signInWithPassword', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      const mockProfile = { id: '123', username: 'testuser', points: 5000 };
      
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: mockProfile, error: null })
          }))
        }))
      });

      await auth.signIn('test@example.com', 'password');

      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password'
      });
    });

    it('should throw error on invalid credentials', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid login credentials' }
      });

      await expect(auth.signIn('test@example.com', 'wrong'))
        .rejects.toThrow('Invalid login credentials');
    });
  });

  describe('signOut', () => {
    it('should call supabase.auth.signOut', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      await auth.signOut();

      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('should return session from supabase.auth.getSession', async () => {
      const mockSession = { user: { id: '123' } };
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession }
      });

      const result = await auth.getCurrentUser();

      expect(result.data.session).toEqual(mockSession);
    });
  });

  describe('onAuthStateChange', () => {
    it('should return unsubscribe function', () => {
      const mockUnsubscribe = vi.fn();
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: mockUnsubscribe } }
      });

      const result = auth.onAuthStateChange(() => {});

      expect(result).toHaveProperty('data');
      expect(typeof result.data.subscription.unsubscribe).toBe('function');
    });
  });
});
