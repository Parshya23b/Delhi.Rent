-- delhi.rent — core table + indexes. Run in Supabase SQL editor or CLI.

create table if not exists public.rent_entries (
  id uuid primary key default gen_random_uuid(),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  rent_inr integer not null check (rent_inr > 0 and rent_inr < 5000000),
  bhk text not null,
  area_label text,
  move_in_month text,
  broker_or_owner text,
  furnishing text,
  device_id_hash text,
  reported boolean default false,
  created_at timestamptz not null default now()
);

-- Future: rent history — append-only log
-- create table public.rent_entry_history (...);

create index if not exists idx_rent_entries_lat_lng on public.rent_entries (lat, lng);
create index if not exists idx_rent_entries_created on public.rent_entries (created_at desc);

alter table public.rent_entries enable row level security;

-- Anonymous reads for map; writes only via service role (recommended) or tighten with policies
create policy "Allow public read"
  on public.rent_entries for select
  using (true);

-- If using anon key from client (not used in this app), allow insert with check:
-- create policy "Allow anon insert" on public.rent_entries for insert with check (true);

comment on table public.rent_entries is 'Crowdsourced rent pins; building aggregation & alerts reserved for future migrations.';
