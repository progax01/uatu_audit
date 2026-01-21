-- Migration: Add user account links table
-- Purpose: Track merged and linked user accounts to support dual authentication
-- Date: 2026-01-21

-- Create user account links table
CREATE TABLE IF NOT EXISTS user_account_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  linked_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  link_type VARCHAR(20) NOT NULL,
  linked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Prevent duplicate links
  CONSTRAINT unique_account_link UNIQUE (primary_user_id, linked_user_id)
);

-- Create indexes for efficient lookups
CREATE INDEX idx_user_account_links_primary ON user_account_links(primary_user_id);
CREATE INDEX idx_user_account_links_linked ON user_account_links(linked_user_id);

-- Add comments
COMMENT ON TABLE user_account_links IS 'Tracks merged and linked user accounts for dual authentication support';
COMMENT ON COLUMN user_account_links.primary_user_id IS 'The primary (kept) user account';
COMMENT ON COLUMN user_account_links.linked_user_id IS 'The secondary (merged/linked) user account';
COMMENT ON COLUMN user_account_links.link_type IS 'Type of link: merged (combined accounts) or linked (separate but connected)';
COMMENT ON COLUMN user_account_links.linked_at IS 'When the accounts were linked';
