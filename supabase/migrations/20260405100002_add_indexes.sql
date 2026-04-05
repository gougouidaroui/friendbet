-- ============================================================================
-- PERFORMANCE: Add missing indexes
-- ============================================================================
-- Speed up the most common query patterns
-- ============================================================================

-- Composite index for the main bet query (filter by status, sort by created_at)
CREATE INDEX IF NOT EXISTS idx_bets_status_created_at
  ON public.bets USING btree (status, created_at DESC);

-- Index for wagers joined by user_id (used in mybets filtering)
CREATE INDEX IF NOT EXISTS idx_wagers_user_id
  ON public.wagers USING btree (user_id);

-- Index for friendships filtered by status (used in friend lookups)
CREATE INDEX IF NOT EXISTS idx_friendships_status
  ON public.friendships USING btree (status);

-- Index for notifications (filter by user_id + read status)
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON public.notifications USING btree (user_id, read);

-- Index for penguin_calendar (filter by user_id + login_date)
CREATE INDEX IF NOT EXISTS idx_penguin_calendar_user_date
  ON public.penguin_calendar USING btree (user_id, login_date DESC);
