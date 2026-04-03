import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn()
        }))
      }))
    })),
    rpc: vi.fn(),
    channel: vi.fn()
  }
}));

const mockGetState = vi.fn(() => ({
  user: { id: 'user-123', email: 'test@example.com' },
  profile: { id: 'user-123', username: 'testuser', points: 5000 }
}));

vi.mock('@/lib/store.js', () => ({
  getState: mockGetState
}));

const { renderBetCard, renderEmptyState } = await import('@/components/bet-card.js');

describe('BetCard Component', () => {
  describe('renderEmptyState', () => {
    it('should render bet empty state', () => {
      const html = renderEmptyState('bet', 'No bets yet', 'Create a bet!');
      
      expect(html).toContain('No bets yet');
      expect(html).toContain('Create a bet!');
      expect(html).toContain('empty-state');
    });

    it('should render shield empty state', () => {
      const html = renderEmptyState('shield', 'No active bets', 'Join a bet!');
      
      expect(html).toContain('No active bets');
      expect(html).toContain('Join a bet!');
    });

    it('should render edit empty state', () => {
      const html = renderEmptyState('edit', 'No drafts', 'Save a draft');
      
      expect(html).toContain('No drafts');
      expect(html).toContain('Save a draft');
    });
  });

  describe('renderBetCard', () => {
    it('should render published bet correctly', () => {
      const bet = {
        id: 'bet-123',
        title: 'Test Bet',
        description: 'Test description',
        status: 'published',
        end_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        creator_id: 'user-other',
        visibility: 'public',
        wagers: []
      };

      const html = renderBetCard(bet, 'feed');

      expect(html).toContain('Test Bet');
      expect(html).toContain('Test description');
      expect(html).toContain('status-published');
      expect(html).toContain('Open');
      expect(html).toContain('data-bet-id="bet-123"');
    });

    it('should render draft bet with edit/delete buttons', () => {
      const bet = {
        id: 'bet-123',
        title: 'Draft Bet',
        status: 'draft',
        end_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        creator_id: 'user-123',
        wagers: []
      };

      const html = renderBetCard(bet, 'drafts');

      expect(html).toContain('status-draft');
      expect(html).toContain('Draft');
      expect(html).toContain('data-action="edit"');
      expect(html).toContain('data-action="delete"');
    });

    it('should render resolved bet with winner info', () => {
      const bet = {
        id: 'bet-123',
        title: 'Resolved Bet',
        status: 'resolved',
        winner: 'for',
        end_time: new Date(Date.now() - 1000).toISOString(),
        creator_id: 'user-other',
        wagers: []
      };

      const html = renderBetCard(bet, 'feed');

      expect(html).toContain('status-resolved');
      expect(html).toContain('For Won');
    });

    it('should show For/Against buttons for open bets', () => {
      const bet = {
        id: 'bet-123',
        title: 'Open Bet',
        status: 'published',
        end_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        creator_id: 'user-other',
        visibility: 'public',
        wagers: []
      };

      const html = renderBetCard(bet, 'feed');

      expect(html).toContain('data-action="bet-for"');
      expect(html).toContain('data-action="bet-against"');
    });

    it('should not show For/Against buttons if user already wagered', () => {
      const bet = {
        id: 'bet-123',
        title: 'Open Bet',
        status: 'published',
        end_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        creator_id: 'user-other',
        visibility: 'public',
        wagers: [{ user_id: 'user-123', side: 'for', amount: 100 }]
      };

      const html = renderBetCard(bet, 'feed');

      expect(html).not.toContain('data-action="bet-for"');
      expect(html).toContain('result-badge');
    });

    it('should show reveal wagers button for resolved bets', () => {
      const bet = {
        id: 'bet-123',
        title: 'Resolved Bet',
        status: 'resolved',
        winner: 'for',
        end_time: new Date(Date.now() - 1000).toISOString(),
        creator_id: 'user-other',
        wagers: []
      };

      const html = renderBetCard(bet, 'feed');

      expect(html).toContain('data-action="reveal-wagers"');
      expect(html).toContain('wager-reveal');
    });

    it('should show select winner button for closed bets by creator', () => {
      const bet = {
        id: 'bet-123',
        title: 'Closed Bet',
        status: 'published',
        end_time: new Date(Date.now() - 1000).toISOString(),
        creator_id: 'user-123',
        wagers: []
      };

      const html = renderBetCard(bet, 'feed');

      expect(html).toContain('data-action="select-winner"');
    });

    it('should show visibility badge for non-public bets', () => {
      const bet = {
        id: 'bet-123',
        title: 'Private Bet',
        status: 'published',
        end_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        creator_id: 'user-123',
        visibility: 'private',
        wagers: []
      };

      const html = renderBetCard(bet, 'feed');

      expect(html).toContain('visibility-badge');
      expect(html).toContain('private');
    });

    it('should escape HTML in title and description', () => {
      const bet = {
        id: 'bet-123',
        title: '<script>alert("xss")</script>',
        description: '<img onerror="alert(1)">',
        status: 'published',
        end_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        creator_id: 'user-other',
        wagers: []
      };

      const html = renderBetCard(bet, 'feed');

      expect(html).not.toContain('<script>');
      expect(html).not.toContain('<img');
    });
  });
});
