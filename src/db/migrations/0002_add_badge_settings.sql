-- Migration: Add badge settings table
-- Purpose: Store project badge visibility and audit selection settings
-- Date: 2026-01-17

-- Create badge settings table
CREATE TABLE IF NOT EXISTS badge_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID UNIQUE NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Settings
  is_public BOOLEAN NOT NULL DEFAULT false,
  selected_audit_id UUID REFERENCES audit_jobs(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_badge_settings_project_id ON badge_settings(project_id);

-- Add comments
COMMENT ON TABLE badge_settings IS 'Stores badge visibility settings for projects';
COMMENT ON COLUMN badge_settings.is_public IS 'Whether the badge is publicly visible';
COMMENT ON COLUMN badge_settings.selected_audit_id IS 'Specific audit to display in badge (null = latest)';
