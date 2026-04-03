const mockData = {
  users: new Map(),
  profiles: new Map(),
  bets: new Map(),
  wagers: new Map(),
  friendships: new Map(),
  transactions: [],
  notifications: [],
  friendshipCounter: 0,
  betCounter: 0,
  wagerCounter: 0,
  notificationCounter: 0
};

export const mockSupabase = {
  auth: {
    signUp: vi.fn(({ email, password, options }) => {
      const id = `user-${Date.now()}`;
      mockData.users.set(id, { id, email, user_metadata: options?.data });
      return { data: { user: { id, email, user_metadata: options?.data } }, error: null };
    }),
    signInWithPassword: vi.fn(({ email, password }) => {
      const user = Array.from(mockData.users.values()).find(u => u.email === email);
      if (user) {
        return { data: { user }, error: null };
      }
      return { data: { user: null }, error: { message: 'Invalid credentials' } };
    }),
    signOut: vi.fn(() => ({ error: null })),
    getSession: vi.fn(() => ({ data: { session: null }, error: null })),
    onAuthStateChange: vi.fn((callback) => {
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    })
  },
  from: (table) => ({
    select: (cols = '*') => ({
      eq: (col, val) => ({
        single: vi.fn(() => {
          const item = mockData[table]?.get(val);
          return item ? { data: item, error: null } : { data: null, error: { code: 'PGRST116' } };
        }),
        order: (col, opts) => {
          const items = Array.from(mockData[table]?.values() || []).filter(item => item[col] === val);
          return { data: items, error: null };
        },
        in: (col, vals) => {
          const items = Array.from(mockData[table]?.values() || []).filter(item => vals.includes(item[col]));
          return { data: items, error: null };
        },
        or: (condition) => ({
          order: (col, opts) => {
            const items = Array.from(mockData[table]?.values() || []);
            return { data: items, error: null };
          }
        }),
        limit: (n) => ({ data: Array.from(mockData[table]?.values() || []).slice(0, n), error: null }),
        contains: (col, val) => {
          const items = Array.from(mockData[table]?.values() || []).filter(item => 
            item[col] && Array.isArray(item[col]) && item[col].some(v => val.some(v2 => v.user_id === v2.user_id))
          );
          return { data: items, error: null };
        }
      }),
      insert: (data) => ({
        single: vi.fn(() => {
          const id = `${table}-${Date.now()}-${Math.random()}`;
          const item = { id, ...data };
          mockData[table]?.set(id, item);
          return { data: item, error: null };
        })
      }),
      update: (data) => ({
        eq: (col, val) => {
          const item = mockData[table]?.get(val);
          if (item) {
            Object.assign(item, data);
            mockData[table]?.set(val, item);
          }
          return { error: null };
        }
      }),
      delete: () => ({
        eq: (col, val) => {
          mockData[table]?.delete(val);
          return { error: null };
        }
      })
    })
  }),
  rpc: vi.fn((funcName, params) => {
    switch (funcName) {
      case 'process_daily_bonus':
        return { data: 5, error: null };
      case 'create_bet':
        return { data: `bet-${Date.now()}`, error: null };
      case 'place_wager':
        return { data: null, error: null };
      case 'resolve_bet':
        return { data: null, error: null };
      case 'send_friend_request':
        return { data: null, error: null };
      case 'accept_friend_request':
        return { data: null, error: null };
      case 'admin_adjust_points':
        return { data: null, error: null };
      default:
        return { data: null, error: null };
    }
  }),
  channel: (name) => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn(() => ({ unsubscribe: vi.fn() }))
  })
};

export function resetMockData() {
  mockData.users.clear();
  mockData.profiles.clear();
  mockData.bets.clear();
  mockData.wagers.clear();
  mockData.friendships.clear();
  mockData.transactions = [];
  mockData.notifications = [];
  mockData.friendshipCounter = 0;
  mockData.betCounter = 0;
  mockData.wagerCounter = 0;
  mockData.notificationCounter = 0;
}

export function createMockUser(overrides = {}) {
  const id = `user-${Date.now()}-${Math.random()}`;
  return {
    id,
    email: `test-${id}@example.com`,
    user_metadata: { username: `user${id.slice(-4)}` },
    ...overrides
  };
}

export function createMockProfile(overrides = {}) {
  return {
    id: `user-${Date.now()}`,
    username: `testuser${Date.now()}`,
    points: 5000,
    is_admin: false,
    last_login: null,
    login_streak: 0,
    created_at: new Date().toISOString(),
    ...overrides
  };
}

export function createMockBet(overrides = {}) {
  return {
    id: `bet-${Date.now()}`,
    title: 'Test Bet',
    description: 'Test description',
    duration: 24,
    stake: 100,
    creator_id: `user-${Date.now()}`,
    created_at: new Date().toISOString(),
    end_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    status: 'published',
    winner: null,
    resolved_at: null,
    fee_paid: 34,
    visibility: 'public',
    wagers: [],
    creator: { id: `user-${Date.now()}`, username: 'testuser' },
    ...overrides
  };
}
