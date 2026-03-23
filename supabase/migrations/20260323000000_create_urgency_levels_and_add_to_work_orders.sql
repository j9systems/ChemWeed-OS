-- Urgency levels lookup table
create table urgency_levels (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null,
  sort_order int not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- Seed the three urgency levels
insert into urgency_levels (key, label, sort_order, is_default) values
  ('emergency', 'Emergency', 1, false),
  ('7_day', '7-Day', 2, false),
  ('flexible', 'Flexible', 3, true);

-- Add urgency_level_id to work_orders with a default of 'flexible'
alter table work_orders
  add column urgency_level_id uuid references urgency_levels(id);

-- Backfill existing work orders to 'flexible'
update work_orders
  set urgency_level_id = (select id from urgency_levels where key = 'flexible');

-- Enable RLS on urgency_levels (read-only for all authenticated users)
alter table urgency_levels enable row level security;

create policy "Authenticated users can read urgency levels"
  on urgency_levels for select
  to authenticated
  using (true);
