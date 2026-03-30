-- Add default_scope_template to service_types
ALTER TABLE service_types
  ADD COLUMN IF NOT EXISTS default_scope_template text;

-- Add line_items to work_order_charges
ALTER TABLE work_order_charges
  ADD COLUMN IF NOT EXISTS line_items jsonb DEFAULT '[]'::jsonb;
