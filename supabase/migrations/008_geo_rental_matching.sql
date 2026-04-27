-- Geo rental matching: pins, matches, reports, PostGIS, RLS, find_matches, bbox RPC, cleanup.
-- Idempotent where practical. Requires PostGIS (005 may already enable it).

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- pins
-- ---------------------------------------------------------------------------
create table if not exists public.pins (
  id uuid primary key default gen_random_uuid(),
  location geography(Point, 4326) not null,
  lat double precision generated always as (st_y(location::geometry)) stored,
  lng double precision generated always as (st_x(location::geometry)) stored,
  type text not null check (type in ('seeker', 'listing')),
  rent integer not null check (rent >= 0 and rent < 50000000),
  bhk integer not null check (bhk >= 0 and bhk <= 20),
  deposit integer check (deposit is null or (deposit >= 0 and deposit < 50000000)),
  available_from date,
  preferences jsonb not null default '{}'::jsonb,
  email text,
  phone text,
  description text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  is_active boolean not null default true,
  is_flagged boolean not null default false,
  flag_count integer not null default 0
);

create index if not exists pins_location_gix on public.pins using gist (location);
create index if not exists pins_rent_idx on public.pins (rent);
create index if not exists pins_type_idx on public.pins (type);
create index if not exists pins_bhk_idx on public.pins (bhk);
create index if not exists pins_expires_at_idx on public.pins (expires_at);
create index if not exists pins_active_expires_idx on public.pins (is_active, expires_at);

comment on table public.pins is 'Map pins for seekers/listings; geography Point SRID 4326.';

-- ---------------------------------------------------------------------------
-- matches
-- ---------------------------------------------------------------------------
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  pin_a uuid not null references public.pins (id) on delete cascade,
  pin_b uuid not null references public.pins (id) on delete cascade,
  matched_at timestamptz not null default now(),
  email_sent boolean not null default false,
  constraint matches_distinct_pins check (pin_a <> pin_b),
  constraint matches_ordered_pair check (pin_a < pin_b)
);

create index if not exists matches_pin_a_idx on public.matches (pin_a);
create index if not exists matches_pin_b_idx on public.matches (pin_b);

create unique index if not exists matches_pair_uidx on public.matches (pin_a, pin_b);

comment on table public.matches is 'Pairings between opposite-type pins within match radius; duplicate pairs prevented.';

-- ---------------------------------------------------------------------------
-- reports (pin abuse / spam)
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  pin_id uuid not null references public.pins (id) on delete cascade,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists reports_pin_id_idx on public.reports (pin_id);
create index if not exists reports_created_at_idx on public.reports (created_at desc);

comment on table public.reports is 'User reports for a pin; increments flag_count on pins.';

-- ---------------------------------------------------------------------------
-- Service-only insert helper (correct geography construction for Edge)
-- ---------------------------------------------------------------------------
create or replace function public.insert_pin_at(
  p_lat double precision,
  p_lng double precision,
  p_type text,
  p_rent integer,
  p_bhk integer,
  p_deposit integer default null,
  p_available_from date default null,
  p_preferences jsonb default '{}'::jsonb,
  p_email text default null,
  p_phone text default null,
  p_description text default null
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
    location,
    type,
    rent,
    bhk,
    deposit,
    available_from,
    preferences,
    email,
    phone,
    description
  )
  values (
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    p_type,
    p_rent,
    p_bhk,
    p_deposit,
    p_available_from,
    coalesce(p_preferences, '{}'::jsonb),
    p_email,
    p_phone,
    p_description
  )
  returning * into strict r;

  return r;
end;
$$;

revoke all on function public.insert_pin_at(
  double precision,
  double precision,
  text,
  integer,
  integer,
  integer,
  date,
  jsonb,
  text,
  text,
  text
) from public;

grant execute on function public.insert_pin_at(
  double precision,
  double precision,
  text,
  integer,
  integer,
  integer,
  date,
  jsonb,
  text,
  text,
  text
) to service_role;

comment on function public.insert_pin_at is 'Creates a pin with geography Point; SECURITY DEFINER for Edge (service role).';

-- ---------------------------------------------------------------------------
-- RLS: pins — public read active; public insert; no client update/delete
-- ---------------------------------------------------------------------------
alter table public.pins enable row level security;

drop policy if exists pins_public_select_active on public.pins;
create policy pins_public_select_active
  on public.pins
  for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists pins_public_insert on public.pins;
create policy pins_public_insert
  on public.pins
  for insert
  to anon, authenticated
  with check (
    type in ('seeker', 'listing')
    and coalesce(is_flagged, false) = false
    and coalesce(flag_count, 0) = 0
    and coalesce(is_active, true) = true
  );

-- matches / reports: no anon access (writes via service role / Edge only)
alter table public.matches enable row level security;
alter table public.reports enable row level security;

-- ---------------------------------------------------------------------------
-- find_matches — opposite type, 2km, rent band, optional bhk, active + unexpired
-- p_exclude_pin_id: omit the pin just inserted (avoids self-match)
-- ---------------------------------------------------------------------------
create or replace function public.find_matches(
  user_lat double precision,
  user_lng double precision,
  user_type text,
  min_rent integer,
  max_rent integer,
  user_bhk integer default null,
  exclude_pin_id uuid default null
)
returns setof public.pins
language sql
stable
as $$
  select p.*
  from public.pins p
  where p.is_active = true
    and p.is_flagged = false
    and p.expires_at > now()
    and p.type in ('seeker', 'listing')
    and p.type <> user_type
    and p.rent between min_rent and max_rent
    and (user_bhk is null or p.bhk = user_bhk)
    and (exclude_pin_id is null or p.id <> exclude_pin_id)
    and st_dwithin(
      p.location,
      st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography,
      2000
    )
  order by st_distance(
    p.location,
    st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography
  ) asc
  limit 50;
$$;

comment on function public.find_matches is
  'Opposite-type pins within 2000m, rent in [min,max], optional bhk equality; active, unexpired, not flagged.';

-- ---------------------------------------------------------------------------
-- Viewport fetch — active + unexpired pins in bbox (geography -> geometry envelope)
-- ---------------------------------------------------------------------------
create or replace function public.get_pins_in_bbox(
  west double precision,
  south double precision,
  east double precision,
  north double precision
)
returns setof public.pins
language sql
stable
as $$
  select p.*
  from public.pins p
  where p.is_active = true
    and p.is_flagged = false
    and p.expires_at > now()
    and p.location && st_makeenvelope(west, south, east, north, 4326)::geography;
$$;

comment on function public.get_pins_in_bbox is
  'Pins inside WGS84 bbox using geography GiST && envelope; filters active, unexpired, not flagged.';

-- ---------------------------------------------------------------------------
-- Report pin — increment flags, insert report, auto-flag / deactivate at threshold
-- ---------------------------------------------------------------------------
create or replace function public.report_pin(
  p_pin_id uuid,
  p_reason text default null,
  p_flag_threshold integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_flagged boolean;
  v_active boolean;
begin
  update public.pins
  set
    flag_count = flag_count + 1,
    is_flagged = case when flag_count + 1 >= p_flag_threshold then true else is_flagged end,
    is_active = case when flag_count + 1 >= p_flag_threshold then false else is_active end
  where id = p_pin_id
  returning flag_count, is_flagged, is_active
  into v_count, v_flagged, v_active;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'pin_not_found');
  end if;

  insert into public.reports (pin_id, reason)
  values (p_pin_id, p_reason);

  return jsonb_build_object(
    'ok', true,
    'pin_id', p_pin_id,
    'flag_count', v_count,
    'is_flagged', v_flagged,
    'is_active', v_active
  );
end;
$$;

revoke all on function public.report_pin(uuid, text, integer) from public;
grant execute on function public.report_pin(uuid, text, integer) to service_role;

comment on function public.report_pin is
  'Increments flag_count, inserts reports row; at threshold marks is_flagged and deactivates pin. SECURITY DEFINER; Edge uses service role.';

-- ---------------------------------------------------------------------------
-- Cleanup expired pins (scheduled job / Edge cron)
-- ---------------------------------------------------------------------------
create or replace function public.cleanup_expired_pins()
returns integer
language sql
security definer
set search_path = public
as $$
  with del as (
    delete from public.pins p
    where p.expires_at <= now()
    returning 1
  )
  select coalesce(count(*)::integer, 0) from del;
$$;

revoke all on function public.cleanup_expired_pins() from public;
grant execute on function public.cleanup_expired_pins() to service_role;

comment on function public.cleanup_expired_pins is 'Deletes pins with expires_at <= now(); returns deleted count.';

-- Lock down RPCs (avoid exposing PII via unrestricted execute grants)
revoke all on function public.find_matches(double precision, double precision, text, integer, integer, integer, uuid) from public;
grant execute on function public.find_matches(double precision, double precision, text, integer, integer, integer, uuid) to service_role;

revoke all on function public.get_pins_in_bbox(double precision, double precision, double precision, double precision) from public;
grant execute on function public.get_pins_in_bbox(double precision, double precision, double precision, double precision) to service_role;
