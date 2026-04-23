-- Bundled migrations 001–007 for fresh Supabase projects.
-- Idempotent: safe to re-run. Paste this whole file into the Supabase SQL editor.

-- ============================================================
-- 001_rent_entries.sql — base table
-- ============================================================
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

create index if not exists idx_rent_entries_lat_lng on public.rent_entries (lat, lng);
create index if not exists idx_rent_entries_created on public.rent_entries (created_at desc);

alter table public.rent_entries enable row level security;

drop policy if exists "Allow public read" on public.rent_entries;
create policy "Allow public read"
  on public.rent_entries for select
  using (true);

comment on table public.rent_entries is 'Crowdsourced rent pins; building aggregation & alerts reserved for future migrations.';

-- ============================================================
-- 002_rent_extras.sql — extra columns
-- ============================================================
alter table public.rent_entries
  add column if not exists maintenance_inr integer,
  add column if not exists deposit_inr integer,
  add column if not exists opt_in_building_aggregate boolean not null default false;

comment on column public.rent_entries.maintenance_inr is 'Optional monthly society/CAM';
comment on column public.rent_entries.deposit_inr is 'Optional one-time security deposit';
comment on column public.rent_entries.opt_in_building_aggregate is 'User opted into fuzzy building-level stats';

-- ============================================================
-- 003_moderation_reports.sql — moderation + reports
-- ============================================================
create table if not exists public.banned_posting_devices (
  device_id_hash text primary key,
  reason text,
  created_at timestamptz not null default now()
);

comment on table public.banned_posting_devices is 'Anonymous devices blocked from new submissions after abuse threshold.';

create table if not exists public.rent_reports (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.rent_entries (id) on delete cascade,
  reporter_device_hash text not null,
  created_at timestamptz not null default now(),
  unique (entry_id, reporter_device_hash)
);

create index if not exists idx_rent_reports_entry on public.rent_reports (entry_id);
create index if not exists idx_rent_reports_reporter on public.rent_reports (reporter_device_hash);

comment on table public.rent_reports is 'Anonymous reports; multiple reporters can flag one pin.';

-- ============================================================
-- 004_women_only.sql — women-only flag
-- ============================================================
alter table public.rent_entries
  add column if not exists women_only boolean not null default false;

comment on column public.rent_entries.women_only is 'Self-reported female-hosted / women-only space; used for map filter.';

-- ============================================================
-- 005_postgis_bbox.sql — spatial index + bbox RPC
-- ============================================================
create extension if not exists postgis;

alter table public.rent_entries add column if not exists geom geometry(Point, 4326);

update public.rent_entries
set geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
where geom is null;

create index if not exists idx_rent_entries_geom on public.rent_entries using gist (geom);

create or replace function public.set_rent_entry_geom()
returns trigger
language plpgsql
as $$
begin
  new.geom := ST_SetSRID(ST_MakePoint(new.lng, new.lat), 4326);
  return new;
end;
$$;

drop trigger if exists trg_rent_entry_geom on public.rent_entries;
create trigger trg_rent_entry_geom
  before insert or update of lat, lng on public.rent_entries
  for each row
  execute function public.set_rent_entry_geom();

create or replace function public.rents_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  since_iso timestamptz
)
returns setof public.rent_entries
language sql
stable
as $$
  select *
  from public.rent_entries
  where geom && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    and created_at >= since_iso;
$$;

comment on function public.rents_in_bbox is 'Indexed viewport fetch for GET /api/rents?minLat&…';

-- ============================================================
-- 006_confidence_score.sql — verification status + confirmations
-- ============================================================
alter table public.rent_entries
  add column if not exists verification_status text not null default 'self-reported',
  add column if not exists confirmations_count integer not null default 0,
  add column if not exists last_updated timestamptz not null default now();

alter table public.rent_entries
  drop constraint if exists rent_entries_verification_status_check;

alter table public.rent_entries
  add constraint rent_entries_verification_status_check
  check (verification_status in ('unverified', 'self-reported', 'verified_document'));

comment on column public.rent_entries.verification_status is 'Trust level: unverified | self-reported | verified_document';
comment on column public.rent_entries.confirmations_count is 'Unique devices that confirmed this pin is still accurate';
comment on column public.rent_entries.last_updated is 'Bumps on author edit or user confirmation';

create table if not exists public.rent_confirmations (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.rent_entries (id) on delete cascade,
  confirmer_device_hash text not null,
  confirmer_ip_hash text,
  created_at timestamptz not null default now(),
  unique (entry_id, confirmer_device_hash)
);

create index if not exists idx_rent_confirmations_entry
  on public.rent_confirmations (entry_id);

create index if not exists idx_rent_confirmations_ip_recent
  on public.rent_confirmations (confirmer_ip_hash, created_at desc);

create or replace function public.rent_entry_after_confirm()
returns trigger
language plpgsql
as $$
begin
  update public.rent_entries
  set confirmations_count = confirmations_count + 1,
      last_updated = now()
  where id = new.entry_id;
  return new;
end;
$$;

drop trigger if exists trg_rent_confirmation_bump on public.rent_confirmations;
create trigger trg_rent_confirmation_bump
  after insert on public.rent_confirmations
  for each row
  execute function public.rent_entry_after_confirm();

update public.rent_entries
set verification_status = coalesce(verification_status, 'self-reported'),
    confirmations_count = coalesce(confirmations_count, 0),
    last_updated = coalesce(last_updated, created_at, now())
where verification_status is null
   or confirmations_count is null
   or last_updated is null;

comment on table public.rent_confirmations is
  'One row per device/session that confirmed a rent pin still accurate (anti-spam: unique per device).';

-- ============================================================
-- 007_seeker_pins.sql — seeker / flatmate matching pins
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.seeker_pins (
  id uuid primary key default gen_random_uuid(),
  lat double precision not null,
  lng double precision not null,
  area_label text,
  looking_for text not null check (looking_for in ('whole_flat','room_in_flat')),
  budget_inr integer not null check (budget_inr between 1000 and 2000000),
  bhk_pref text not null check (bhk_pref in ('1BHK','2BHK','3BHK','any')) default 'any',
  move_in_timeline text not null check (move_in_timeline in ('asap','next_month','flexible')) default 'flexible',
  food_pref text not null check (food_pref in ('veg','non_veg','any')) default 'any',
  smoke_pref text check (smoke_pref in ('smoker','non_smoker','no_preference')),
  self_gender text check (self_gender in ('male','female','other')),
  pref_flatmate_gender text not null check (pref_flatmate_gender in ('male','female','any')) default 'any',
  lifestyle_note text check (char_length(coalesce(lifestyle_note, '')) <= 500),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (phone is null or phone ~ '^[0-9+()\-\s]{7,20}$'),
  device_id_hash text,
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active','archived'))
);

create index if not exists seeker_pins_created_at_idx on public.seeker_pins (created_at desc);
create index if not exists seeker_pins_status_idx on public.seeker_pins (status);
create index if not exists seeker_pins_latlng_idx on public.seeker_pins (lat, lng);

do $seeker_geom$
begin
  if exists (select 1 from pg_extension where extname = 'postgis') then
    execute 'alter table public.seeker_pins add column if not exists geom geography(Point, 4326)';
    execute 'create index if not exists seeker_pins_geom_idx on public.seeker_pins using gist (geom)';

    execute $trg$
      create or replace function public.seeker_pins_set_geom()
      returns trigger language plpgsql as $fn$
      begin
        new.geom := st_setsrid(st_makepoint(new.lng, new.lat), 4326)::geography;
        new.updated_at := now();
        return new;
      end;
      $fn$;
    $trg$;

    execute 'drop trigger if exists trg_seeker_pins_set_geom on public.seeker_pins';
    execute 'create trigger trg_seeker_pins_set_geom before insert or update on public.seeker_pins for each row execute function public.seeker_pins_set_geom()';

    execute 'update public.seeker_pins set geom = st_setsrid(st_makepoint(lng, lat), 4326)::geography where geom is null';
  end if;
end;
$seeker_geom$;

alter table public.seeker_pins enable row level security;

drop policy if exists "seeker_pins anon insert" on public.seeker_pins;
create policy "seeker_pins anon insert"
  on public.seeker_pins for insert
  to anon, authenticated
  with check (true);

drop policy if exists "seeker_pins service read" on public.seeker_pins;
create policy "seeker_pins service read"
  on public.seeker_pins for select
  to service_role
  using (true);

create or replace view public.seeker_pins_public as
  select
    id, lat, lng, area_label,
    looking_for, budget_inr, bhk_pref,
    move_in_timeline, food_pref, smoke_pref,
    self_gender, pref_flatmate_gender, lifestyle_note,
    created_at, status
  from public.seeker_pins
  where status = 'active';

grant select on public.seeker_pins_public to anon, authenticated;

comment on table public.seeker_pins is 'Anonymous flatmate/room seeker pins. email + phone are private and never exposed via the public view.';
comment on view public.seeker_pins_public is 'Safe, PII-free view of seeker_pins. Use this for public map reads.';
