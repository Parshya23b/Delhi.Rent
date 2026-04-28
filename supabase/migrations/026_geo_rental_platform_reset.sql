-- =============================================================================
-- 026 — SAFE RESET + geo rental matching platform (pins / matches / reports / ratings)
--
-- BREAKING: removes rent_entries / areas / seeker stack. Next.js APIs must call
-- `pins` + RPCs in this file (or a new API layer) after you run this migration.
--
-- STEP 0 — Inventory of CUSTOM public tables this repo historically created
-- (not Supabase system tables). Drops are IF EXISTS + CASCADE inside a txn.
--
--   rent_history, verification_logs, rent_sources, rent_entries, areas,
--   rent_reports, rent_confirmations, banned_posting_devices,
--   contact_requests, matches (legacy seeker↔listing), seeker_preferences,
--   seeker_pins, view rent_entries_expanded, optional legacy pins/reports.
--
-- Run once on a project you intend to fully replace. BACK UP FIRST.
-- =============================================================================

begin;

-- Views first (depend on legacy tables)
drop view if exists public.rent_entries_expanded cascade;
drop view if exists public.seeker_pins_public cascade;

-- Legacy geo experiment (harmless if absent)
drop table if exists public.ratings cascade;
drop table if exists public.reports cascade;
drop table if exists public.matches cascade;
drop table if exists public.pins cascade;

-- Auth seeker / contact stack (012+)
drop table if exists public.contact_requests cascade;
drop table if exists public.seeker_preferences cascade;
drop table if exists public.seeker_pins cascade;

-- Domain rent model (009) — children before parents
drop table if exists public.rent_history cascade;
drop table if exists public.verification_logs cascade;
drop table if exists public.rent_sources cascade;
drop table if exists public.rent_confirmations cascade;
drop table if exists public.rent_reports cascade;
drop table if exists public.rent_entries cascade;
drop table if exists public.areas cascade;
drop table if exists public.banned_posting_devices cascade;

-- Orphan enum types from legacy seeker migrations (012)
drop type if exists public.seeker_contact_request_status cascade;
drop type if exists public.seeker_match_status cascade;
drop type if exists public.seeker_cleanliness_level cascade;
drop type if exists public.seeker_social_level cascade;
drop type if exists public.seeker_work_type cascade;
drop type if exists public.seeker_sleep_pattern cascade;
drop type if exists public.seeker_preferred_gender cascade;
drop type if exists public.seeker_gender cascade;
drop type if exists public.seeker_smoking_pref cascade;
drop type if exists public.seeker_food_pref cascade;
drop type if exists public.seeker_move_in cascade;
drop type if exists public.seeker_intent_type cascade;

commit;

-- =============================================================================
-- STEP 1 — Extensions
-- =============================================================================

create extension if not exists postgis;
create extension if not exists "uuid-ossp";

-- =============================================================================
-- STEP 2 — Core tables
-- =============================================================================

create table public.pins (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('owner', 'seeker')),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  location geography(Point, 4326) not null,
  rent integer not null default 0 check (rent >= 0 and rent < 50000000),
  bhk integer not null default 0 check (bhk >= 0 and bhk <= 20),
  furnishing text,
  preferences jsonb not null default '{}'::jsonb,
  contact_email text,
  contact_phone text,
  ip_hash text,
  trust_score double precision not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  deleted boolean not null default false
);

create index pins_location_gix on public.pins using gist (location);
create index pins_type_idx on public.pins (type);
create index pins_created_at_idx on public.pins (created_at desc);
create index pins_ip_created_idx on public.pins (ip_hash, created_at desc);
create index pins_active_idx on public.pins (deleted, expires_at) where deleted = false;

comment on table public.pins is 'Geo pins: owner listings vs seeker demand; soft-delete via deleted.';

create table public.matches (
  id uuid primary key default uuid_generate_v4(),
  pin_a uuid not null references public.pins (id) on delete cascade,
  pin_b uuid not null references public.pins (id) on delete cascade,
  match_score double precision not null default 0,
  notified boolean not null default false,
  created_at timestamptz not null default now(),
  constraint matches_distinct check (pin_a <> pin_b),
  constraint matches_ordered check (pin_a::text < pin_b::text),
  constraint matches_unique_pair unique (pin_a, pin_b)
);

create index matches_notified_idx on public.matches (notified) where notified = false;
create index matches_created_idx on public.matches (created_at desc);

comment on table public.matches is 'Owner↔seeker pairs inside match engine rules; pin_a < pin_b for stable uniqueness.';

create table public.reports (
  id uuid primary key default uuid_generate_v4(),
  pin_id uuid not null references public.pins (id) on delete cascade,
  reason text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index reports_pin_idx on public.reports (pin_id);

create table public.ratings (
  id uuid primary key default uuid_generate_v4(),
  pin_id uuid not null references public.pins (id) on delete cascade,
  rating_type text not null,
  value integer not null check (value between 1 and 5),
  ip_hash text,
  created_at timestamptz not null default now()
);

create index ratings_pin_idx on public.ratings (pin_id);

-- =============================================================================
-- Triggers: location from lat/lng; rate limit 5 pins / ip_hash / day
-- =============================================================================

create or replace function public.pins_set_location_from_lat_lng()
returns trigger
language plpgsql
as $$
begin
  new.location := st_setsrid(st_makepoint(new.lng, new.lat), 4326)::geography;
  return new;
end;
$$;

drop trigger if exists trg_pins_set_location on public.pins;
create trigger trg_pins_set_location
  before insert or update of lat, lng on public.pins
  for each row
  execute function public.pins_set_location_from_lat_lng();

create or replace function public.pins_enforce_daily_ip_limit()
returns trigger
language plpgsql
as $$
declare
  c integer;
begin
  if new.ip_hash is null or length(trim(new.ip_hash)) = 0 then
    return new;
  end if;
  select count(*)::integer
  into c
  from public.pins p
  where p.ip_hash = new.ip_hash
    and p.created_at >= (now() - interval '1 day')
    and not p.deleted;
  if c >= 5 then
    raise exception 'PIN_RATE_LIMIT' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pins_ip_limit on public.pins;
create trigger trg_pins_ip_limit
  before insert on public.pins
  for each row
  execute function public.pins_enforce_daily_ip_limit();

-- =============================================================================
-- STEP 3 — RPCs & engine
-- =============================================================================

create or replace function public.insert_pin(
  p_type text,
  p_lat double precision,
  p_lng double precision,
  p_rent integer,
  p_bhk integer,
  p_furnishing text default null,
  p_preferences jsonb default '{}'::jsonb,
  p_contact_email text default null,
  p_contact_phone text default null,
  p_ip_hash text default null
)
returns public.pins
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.pins;
begin
  insert into public.pins (
    type, lat, lng, rent, bhk, furnishing, preferences,
    contact_email, contact_phone, ip_hash
  )
  values (
    p_type, p_lat, p_lng,
    p_rent, p_bhk, p_furnishing, coalesce(p_preferences, '{}'::jsonb),
    p_contact_email, p_contact_phone, p_ip_hash
  )
  returning * into strict r;
  return r;
end;
$$;

revoke all on function public.insert_pin(text, double precision, double precision, integer, integer, text, jsonb, text, text, text) from public;
grant execute on function public.insert_pin(text, double precision, double precision, integer, integer, text, jsonb, text, text, text) to anon, authenticated, service_role;

create or replace function public.get_nearby_pins(
  user_lat double precision,
  user_lng double precision,
  radius integer default 2000
)
returns setof public.pins
language sql
stable
as $$
  select p.*
  from public.pins p
  where not p.deleted
    and p.expires_at > now()
    and st_dwithin(
      p.location,
      st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
      radius
    )
  order by st_distance(
    p.location,
    st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
  ) asc
  limit 100;
$$;

comment on function public.get_nearby_pins is 'Active pins within radius meters (default 2000); max 100.';

grant execute on function public.get_nearby_pins(double precision, double precision, integer) to anon, authenticated, service_role;

create or replace function public.get_pins_in_bounds(
  lat_min double precision,
  lat_max double precision,
  lng_min double precision,
  lng_max double precision
)
returns setof public.pins
language sql
stable
as $$
  select p.*
  from public.pins p
  where not p.deleted
    and p.expires_at > now()
    and p.lat between lat_min and lat_max
    and p.lng between lng_min and lng_max;
$$;

grant execute on function public.get_pins_in_bounds(double precision, double precision, double precision, double precision) to anon, authenticated, service_role;

create or replace function public.match_pins()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer := 0;
begin
  insert into public.matches (pin_a, pin_b, match_score, notified)
  select
    least(o.id, s.id) as pin_a,
    greatest(o.id, s.id) as pin_b,
    greatest(
      0.0,
      least(1.0, 1.0 - (
        st_distance(o.location, s.location) / 2000.0
      ))
    ) as match_score,
    false
  from public.pins o
  join public.pins s
    on o.type = 'owner'
   and s.type = 'seeker'
   and o.id <> s.id
   and not o.deleted
   and not s.deleted
   and o.expires_at > now()
   and s.expires_at > now()
   and o.bhk = s.bhk
   and s.rent between (o.rent * 0.8)::numeric and (o.rent * 1.2)::numeric
   and st_dwithin(o.location, s.location, 2000)
  on conflict (pin_a, pin_b) do nothing;

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.match_pins() from public;
grant execute on function public.match_pins() to service_role;

comment on function public.match_pins is 'Pairs owner↔seeker within 2km, same BHK, seeker rent within ±20% of owner; idempotent.';

create or replace function public.delete_expired_pins()
returns integer
language sql
security definer
set search_path = public
as $$
  with u as (
    update public.pins p
    set deleted = true
    where p.expires_at <= now()
      and not p.deleted
    returning 1
  )
  select coalesce(count(*)::integer, 0) from u;
$$;

revoke all on function public.delete_expired_pins() from public;
grant execute on function public.delete_expired_pins() to service_role;

-- =============================================================================
-- STEP 4 — RLS (minimal: public read/write pins; matches via service / edge)
-- =============================================================================

alter table public.pins enable row level security;
alter table public.matches enable row level security;
alter table public.reports enable row level security;
alter table public.ratings enable row level security;

drop policy if exists pins_select_active on public.pins;
create policy pins_select_active
  on public.pins for select to anon, authenticated
  using (not deleted and expires_at > now());

drop policy if exists pins_insert_any on public.pins;
create policy pins_insert_any
  on public.pins for insert to anon, authenticated
  with check (not deleted);

-- No client updates/deletes on pins (use service role or SECURITY DEFINER RPCs)

drop policy if exists reports_insert on public.reports;
create policy reports_insert
  on public.reports for insert to anon, authenticated
  with check (true);

drop policy if exists ratings_insert on public.ratings;
create policy ratings_insert
  on public.ratings for insert to anon, authenticated
  with check (true);

-- matches: no anon policies (Edge Function uses service_role)

-- =============================================================================
-- STEP 5 — Realtime (pins + matches)
-- =============================================================================

do $pub$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pins'
  ) then
    execute 'alter publication supabase_realtime add table public.pins';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches'
  ) then
    execute 'alter publication supabase_realtime add table public.matches';
  end if;
exception
  when duplicate_object then null;
  when insufficient_privilege then
    raise notice '026: add pins/matches to supabase_realtime from dashboard if lacking privileges.';
end;
$pub$;

-- =============================================================================
-- STEP 7 — Manual test flow (SQL editor; use service role for match_pins)
-- =============================================================================
-- 1) Insert pins (example — adjust lat/lng to your city):
--
--   select public.insert_pin(
--     'owner', 12.97, 77.59, 25000, 2, 'semi', '{}'::jsonb,
--     'owner@example.com', null, 'ip-owner-demo'
--   );
--   select public.insert_pin(
--     'seeker', 12.971, 77.591, 24000, 2, null, '{}'::jsonb,
--     'seeker@example.com', null, 'ip-seeker-demo'
--   );
--
-- 2) Run matcher (service role / SQL as superuser):
--   select public.match_pins();
--
-- 3) Inspect queue:
--   select * from public.matches where notified = false;
--
-- 4) Call Edge Function `send-match-notifications` (POST) or:
--   update public.matches set notified = true where id = '<match_id>';
--
-- 5) Expiry soft-delete (cron):
--   select public.delete_expired_pins();
