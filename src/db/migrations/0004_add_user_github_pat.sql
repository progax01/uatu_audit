-- Add encrypted GitHub PAT fields to users table
ALTER TABLE users
ADD COLUMN github_pat_encrypted TEXT,
ADD COLUMN github_pat_iv VARCHAR(64);

-- Add index for faster lookups
CREATE INDEX users_github_pat_idx ON users(github_pat_encrypted) WHERE github_pat_encrypted IS NOT NULL;
