-- Migration: Add contract classifications table
-- Purpose: Store contract type detection results for adaptive UI and questionnaires
-- Date: 2025-01-17

-- Create contract category enum
CREATE TYPE contract_category AS ENUM (
  'erc20-token',
  'erc721-nft',
  'erc1155-multi',
  'defi-amm',
  'defi-lending',
  'defi-staking',
  'governance',
  'bridge',
  'proxy-upgradeable',
  'multisig-wallet',
  'generic'
);

-- Create contract classifications table
CREATE TABLE contract_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID UNIQUE NOT NULL REFERENCES audit_jobs(id) ON DELETE CASCADE,

  -- Classification results
  category contract_category NOT NULL,
  sub_category VARCHAR(100),

  -- Detection details
  interfaces JSONB DEFAULT '[]',  -- ['IERC20', 'Ownable', 'ReentrancyGuard']
  patterns JSONB DEFAULT '[]',    -- ['minting', 'burning', 'pausing', 'staking']
  confidence DECIMAL(3,2),        -- 0.00 to 1.00

  -- Metadata
  detection_metadata JSONB DEFAULT '{}',  -- Additional detection info
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_contract_classifications_job_id ON contract_classifications(job_id);
CREATE INDEX idx_contract_classifications_category ON contract_classifications(category);
CREATE INDEX idx_contract_classifications_confidence ON contract_classifications(confidence);

-- Add urgency and blocking fields to audit_clarifications
ALTER TABLE audit_clarifications ADD COLUMN IF NOT EXISTS urgency VARCHAR(20) DEFAULT 'important';
ALTER TABLE audit_clarifications ADD COLUMN IF NOT EXISTS blocking BOOLEAN DEFAULT false;

COMMENT ON TABLE contract_classifications IS 'Stores automatic contract type classification for adaptive questionnaires and UI';
COMMENT ON COLUMN contract_classifications.category IS 'Primary contract category detected';
COMMENT ON COLUMN contract_classifications.interfaces IS 'Detected interfaces (ERC20, ERC721, Ownable, etc.)';
COMMENT ON COLUMN contract_classifications.patterns IS 'Detected patterns (minting, staking, governance, etc.)';
COMMENT ON COLUMN contract_classifications.confidence IS 'Classification confidence score 0-1';
