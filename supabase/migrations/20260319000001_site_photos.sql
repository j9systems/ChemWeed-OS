-- Site photos: images associated with a site
create table site_photos (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  photo_url text not null,
  caption text,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid references auth.users(id)
);

create index on site_photos(site_id);
