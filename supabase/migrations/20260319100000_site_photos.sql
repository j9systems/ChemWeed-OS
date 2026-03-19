-- Site photos table for storing images associated with a site
create table if not exists site_photos (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  url text not null,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid
);

create index idx_site_photos_site_id on site_photos(site_id);
