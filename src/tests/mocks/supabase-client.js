import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  channel: vi.fn().mockReturnValue(mockChannel)
};

vi.mock('@/lib/supabase.js', () => ({
  supabase: mockSupabase
}));

export { mockSupabase, mockChannel };
