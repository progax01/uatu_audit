-- Add commit resolution fields to audit_clarifications table
-- Migration: 0005_add_commit_resolution_fields
-- Created: 2026-01-23

-- Add new columns for tracking commit-based resolutions
ALTER TABLE audit_clarifications
ADD COLUMN resolved_in_commit BOOLEAN DEFAULT FALSE,
ADD COLUMN commit_sha VARCHAR(64),
ADD COLUMN commit_message TEXT,
ADD COLUMN commit_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN verification_note TEXT;

-- Create index for faster queries on commit resolution
CREATE INDEX idx_clarifications_commit ON audit_clarifications(commit_sha) WHERE commit_sha IS NOT NULL;

-- Create index for finding pending clarifications
CREATE INDEX idx_clarifications_status_job ON audit_clarifications(job_id, status) WHERE status = 'answered';

-- Add comment for documentation
COMMENT ON COLUMN audit_clarifications.resolved_in_commit IS 'Indicates if the finding was marked as resolved in a specific commit';
COMMENT ON COLUMN audit_clarifications.commit_sha IS 'The SHA hash of the commit where the finding was resolved';
COMMENT ON COLUMN audit_clarifications.commit_message IS 'The commit message for the resolution commit';
COMMENT ON COLUMN audit_clarifications.commit_verified IS 'Whether the commit resolution has been verified by re-analysis';
COMMENT ON COLUMN audit_clarifications.verification_note IS 'Notes from the verification process';
