-- Insert default Neurons token pricing configuration

INSERT INTO token_pricing_config (config_key, config_value, description) VALUES
  ('neurons_per_sloc_multiplier', 1, 'Multiplier for neurons per SLOC (divide by 1000 for actual rate of 0.001)'),
  ('neurons_per_sloc_divisor', 1000, 'Divisor for neurons per SLOC calculation'),
  ('neurons_per_1k_ai_tokens', 10, 'Neurons charged per 1000 AI tokens consumed'),
  ('reservation_buffer_percent', 150, 'Buffer percentage for reservations (150 = 1.5x estimated cost)'),
  ('grace_period_audits', 1, 'Number of audits allowed to go into debt before blocking')
ON CONFLICT (config_key) DO NOTHING;
