-- Site weed profile: curated list of known weed species at a site
create table site_weed_profile (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  weed_name text not null,
  notes text,
  added_at timestamptz not null default now(),
  added_by uuid references auth.users(id)
);

-- Observation logs: append-only visit records
create table site_observation_logs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  work_order_id uuid references work_orders(id) on delete set null,
  observed_at timestamptz not null default now(),
  observed_by uuid references auth.users(id),
  weed_species text[],
  density text,
  conditions text,
  notes text,
  photo_urls text[] default '{}'
);

create index on site_weed_profile(site_id);
create index on site_observation_logs(site_id, observed_at desc);
