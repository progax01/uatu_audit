-- ============================================================================
-- Neurons Token Payment System Migration
-- Implements upfront reservation payment model with debt tracking
-- ============================================================================

-- Create enums
CREATE TYPE token_payment_status AS ENUM (
  'pending',
  'reserved',
  'processing',
  'completed',
  'in_debt',
  'refunded',
  'failed'
);

CREATE TYPE token_transaction_type AS ENUM (
  'reservation',
  'debit',
  'refund',
  'debt_payment',
  'adjustment'
);

-- Token Payment Reservations Table
CREATE TABLE token_payment_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL UNIQUE REFERENCES audit_jobs(id) ON DELETE CASCADE,

  -- Cost Estimation
  estimated_sloc BIGINT NOT NULL,
  estimated_ai_tokens BIGINT NOT NULL,
  estimated_cost_neurons BIGINT NOT NULL,

  -- Reservation (with buffer)
  reservation_amount BIGINT NOT NULL,
  buffer_multiplier INTEGER NOT NULL DEFAULT 150,

  -- Actual Usage (populated after audit)
  actual_sloc BIGINT,
  actual_ai_tokens BIGINT,
  actual_cost_neurons BIGINT,

  -- Wallet & Transaction
  wallet_address VARCHAR(128) NOT NULL,
  chain_id SMALLINT NOT NULL DEFAULT 1,
  tx_hash VARCHAR(100),

  -- Status
  status token_payment_status NOT NULL DEFAULT 'pending',

  -- Debt tracking
  debt_amount BIGINT DEFAULT 0,
  debt_paid_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  reserved_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Token Payment Transactions Table
CREATE TABLE token_payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES token_payment_reservations(id) ON DELETE CASCADE,
  job_id UUID REFERENCES audit_jobs(id) ON DELETE CASCADE,

  -- Transaction details
  transaction_type token_transaction_type NOT NULL,
  amount BIGINT NOT NULL,
  balance_before BIGINT NOT NULL,
  balance_after BIGINT NOT NULL,

  -- Context
  description TEXT NOT NULL,
  metadata JSONB,

  -- Blockchain transaction
  wallet_address VARCHAR(128),
  tx_hash VARCHAR(100),
  chain_id SMALLINT,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- User Debt Tracking Table
CREATE TABLE user_token_debt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- Debt details
  total_debt_neurons BIGINT NOT NULL DEFAULT 0,
  unpaid_audit_count SMALLINT NOT NULL DEFAULT 0,

  -- Block status
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  blocked_at TIMESTAMP WITH TIME ZONE,
  blocked_reason TEXT,

  -- Grace period
  grace_period_used BOOLEAN NOT NULL DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_debt_payment_at TIMESTAMP WITH TIME ZONE
);

-- Token Pricing Configuration Table
CREATE TABLE token_pricing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value BIGINT NOT NULL,
  description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for token_payment_reservations
CREATE INDEX token_reservations_user_id_idx ON token_payment_reservations(user_id);
CREATE UNIQUE INDEX token_reservations_job_id_idx ON token_payment_reservations(job_id);
CREATE INDEX token_reservations_status_idx ON token_payment_reservations(status);
CREATE INDEX token_reservations_wallet_idx ON token_payment_reservations(wallet_address);

-- Create indexes for token_payment_transactions
CREATE INDEX token_transactions_user_id_idx ON token_payment_transactions(user_id);
CREATE INDEX token_transactions_reservation_id_idx ON token_payment_transactions(reservation_id);
CREATE INDEX token_transactions_job_id_idx ON token_payment_transactions(job_id);
CREATE INDEX token_transactions_type_idx ON token_payment_transactions(transaction_type);
CREATE INDEX token_transactions_created_at_idx ON token_payment_transactions(created_at);

-- Create indexes for user_token_debt
CREATE UNIQUE INDEX user_token_debt_user_id_idx ON user_token_debt(user_id);
CREATE INDEX user_token_debt_is_blocked_idx ON user_token_debt(is_blocked);

-- Create index for token_pricing_config
CREATE UNIQUE INDEX token_pricing_config_key_idx ON token_pricing_config(config_key);

-- Insert default pricing configuration
-- Neurons per line of code: 0.001 (stored as 1 with division by 1000)
-- Neurons per 1000 AI tokens: 10
INSERT INTO token_pricing_config (config_key, config_value, description) VALUES
  ('neurons_per_sloc_multiplier', 1, 'Multiplier for neurons per SLOC (divide by 1000 for actual rate of 0.001)'),
  ('neurons_per_sloc_divisor', 1000, 'Divisor for neurons per SLOC calculation'),
  ('neurons_per_1k_ai_tokens', 10, 'Neurons charged per 1000 AI tokens consumed'),
  ('reservation_buffer_percent', 150, 'Buffer percentage for reservations (150 = 1.5x estimated cost)'),
  ('grace_period_audits', 1, 'Number of audits allowed to go into debt before blocking');

-- Add comment explaining Neurons token
COMMENT ON TABLE token_payment_reservations IS 'Tracks upfront Neurons token payment reservations for audits. Neurons ERC-20 token address: 0xE5251763988DcF2065cc67f085f9E131E2f81918';
