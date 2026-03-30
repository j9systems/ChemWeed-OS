-- Add default_rate_per_acre to chemicals table
-- Used for estimating chemical cost on work order estimates (distinct from tank mixing rate)
ALTER TABLE chemicals
  ADD COLUMN IF NOT EXISTS default_rate_per_acre numeric(10,4);
