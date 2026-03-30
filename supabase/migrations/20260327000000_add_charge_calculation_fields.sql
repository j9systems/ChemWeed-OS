-- Add calculated-charge fields to work_order_charges
alter table work_order_charges
  add column if not exists service_type_id uuid references service_types(id),
  add column if not exists acreage numeric,
  add column if not exists hours numeric,
  add column if not exists unit_rate numeric,
  add column if not exists is_manual_override boolean not null default true;

-- Existing rows are manual overrides by definition (default true handles that).
-- Make description nullable so calculated charges can omit it.
alter table work_order_charges
  alter column description drop not null;
