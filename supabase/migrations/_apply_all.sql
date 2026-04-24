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

-- ============================================================
-- 008_anon_execute_rents_in_bbox.sql — anon can call bbox RPC
-- ============================================================
grant execute on function public.rents_in_bbox(
  double precision,
  double precision,
  double precision,
  double precision,
  timestamptz
) to anon, authenticated;

-- ============================================================
-- 009_domain_rent_model.sql (see migrations/009_domain_rent_model.sql)
-- ============================================================
-- 009: Normalized rent model — areas, rent_entries (area_id + rent + bhk + furnishing),
-- rent_sources, verification_logs. Compatibility view rent_entries_expanded for the app.
-- submitter_device_hash on rent_sources is used only for anonymous spam/reporting (not exposed in API).

create extension if not exists postgis;

-- ---------------------------------------------------------------------------
-- areas
-- ---------------------------------------------------------------------------
create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  created_at timestamptz not null default now()
);

alter table public.areas add column if not exists geom geometry(Point, 4326);

update public.areas
set geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
where geom is null;

create index if not exists idx_areas_geom on public.areas using gist (geom);

create or replace function public.set_area_geom()
returns trigger
language plpgsql
as $$
begin
  new.geom := ST_SetSRID(ST_MakePoint(new.lng, new.lat), 4326);
  return new;
end;
$$;

drop trigger if exists trg_area_geom on public.areas;
create trigger trg_area_geom
  before insert or update of lat, lng on public.areas
  for each row
  execute function public.set_area_geom();

alter table public.areas enable row level security;
drop policy if exists "areas public read" on public.areas;
create policy "areas public read"
  on public.areas for select
  using (true);

comment on table public.areas is 'Map anchor / locality label for rent_entries.';

-- ---------------------------------------------------------------------------
-- Link legacy rows to areas
-- ---------------------------------------------------------------------------
alter table public.rent_entries add column if not exists area_id uuid references public.areas (id);

do $$
declare
  r record;
  aid uuid;
begin
  for r in
    select id, lat, lng, coalesce(nullif(trim(area_label), ''), 'Pin') as lbl
    from public.rent_entries
    where area_id is null
  loop
    insert into public.areas (label, lat, lng)
    values (r.lbl, r.lat, r.lng)
    returning id into aid;
    update public.rent_entries set area_id = aid where id = r.id;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- rent_sources (before stripping legacy rent_entries columns)
-- ---------------------------------------------------------------------------
create table if not exists public.rent_sources (
  id uuid primary key default gen_random_uuid(),
  rent_entry_id uuid not null references public.rent_entries (id) on delete cascade,
  source_type text not null
    check (source_type in ('user', 'scraped', 'broker', 'owner')),
  confidence_score smallint not null
    check (confidence_score between 0 and 100),
  verified boolean not null default false,
  submitter_device_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_rent_sources_entry on public.rent_sources (rent_entry_id);

insert into public.rent_sources (
  rent_entry_id,
  source_type,
  confidence_score,
  verified,
  submitter_device_hash
)
select
  re.id,
  case
    when lower(coalesce(re.broker_or_owner, '')) like '%broker%' then 'broker'::text
    when lower(coalesce(re.broker_or_owner, '')) like '%owner%' then 'owner'::text
    else 'user'::text
  end,
  case coalesce(re.verification_status, 'self-reported')
    when 'verified_document' then 90::smallint
    when 'self-reported' then 55::smallint
    else 35::smallint
  end,
  coalesce(re.verification_status, '') = 'verified_document',
  re.device_id_hash
from public.rent_entries re
where not exists (
  select 1 from public.rent_sources rs where rs.rent_entry_id = re.id
);

-- ---------------------------------------------------------------------------
-- verification_logs + migrate from rent_confirmations
-- ---------------------------------------------------------------------------
create table if not exists public.verification_logs (
  id uuid primary key default gen_random_uuid(),
  rent_entry_id uuid not null references public.rent_entries (id) on delete cascade,
  action text not null check (action in ('confirmed', 'disputed', 'outdated')),
  user_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_verification_logs_entry on public.verification_logs (rent_entry_id);

create unique index if not exists verification_logs_one_confirm_per_user
  on public.verification_logs (rent_entry_id, user_id)
  where action = 'confirmed';

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'rent_confirmations'
  ) then
    insert into public.verification_logs (rent_entry_id, action, user_id, created_at)
    select rc.entry_id, 'confirmed', rc.confirmer_device_hash, rc.created_at
    from public.rent_confirmations rc
    where not exists (
      select 1
      from public.verification_logs vl
      where vl.rent_entry_id = rc.entry_id
        and vl.user_id = rc.confirmer_device_hash
        and vl.action = 'confirmed'
    );
  end if;
end $$;

drop trigger if exists trg_rent_confirmation_bump on public.rent_confirmations;
drop function if exists public.rent_entry_after_confirm();
drop table if exists public.rent_confirmations;

alter table public.verification_logs enable row level security;
drop policy if exists "verification_logs public read" on public.verification_logs;
create policy "verification_logs public read"
  on public.verification_logs for select
  using (true);

comment on table public.verification_logs is 'confirmed | disputed | outdated; user_id is anonymized (e.g. device hash).';

alter table public.rent_sources enable row level security;
drop policy if exists "rent_sources public read" on public.rent_sources;
create policy "rent_sources public read"
  on public.rent_sources for select
  using (true);

-- ---------------------------------------------------------------------------
-- Strip legacy rent_entries columns; rename rent_inr → rent
-- ---------------------------------------------------------------------------
drop trigger if exists trg_rent_entry_geom on public.rent_entries;
drop function if exists public.set_rent_entry_geom();

drop function if exists public.rents_in_bbox(double precision, double precision, double precision, double precision, timestamptz);

drop index if exists public.idx_rent_entries_lat_lng;
drop index if exists public.idx_rent_entries_geom;

alter table public.rent_entries drop column if exists lat;
alter table public.rent_entries drop column if exists lng;
alter table public.rent_entries drop column if exists area_label;
alter table public.rent_entries drop column if exists move_in_month;
alter table public.rent_entries drop column if exists broker_or_owner;
alter table public.rent_entries drop column if exists device_id_hash;
alter table public.rent_entries drop column if exists reported;
alter table public.rent_entries drop column if exists maintenance_inr;
alter table public.rent_entries drop column if exists deposit_inr;
alter table public.rent_entries drop column if exists opt_in_building_aggregate;
alter table public.rent_entries drop column if exists women_only;
alter table public.rent_entries drop column if exists verification_status;
alter table public.rent_entries drop column if exists confirmations_count;
alter table public.rent_entries drop column if exists last_updated;
alter table public.rent_entries drop column if exists geom;

alter table public.rent_entries drop constraint if exists rent_entries_rent_inr_check;
alter table public.rent_entries drop constraint if exists rent_entries_rent_check;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'rent_entries'
      and column_name = 'rent_inr'
  ) then
    alter table public.rent_entries rename column rent_inr to rent;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'rent_entries_rent_check'
      and conrelid = 'public.rent_entries'::regclass
  ) then
    alter table public.rent_entries add constraint rent_entries_rent_check
      check (rent > 0 and rent < 5000000);
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'rent_entries'
      and column_name = 'area_id'
      and is_nullable = 'YES'
  ) then
    alter table public.rent_entries alter column area_id set not null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Expanded view + bbox RPC
-- ---------------------------------------------------------------------------
create or replace view public.rent_entries_expanded as
select
  e.id,
  a.lat,
  a.lng,
  e.rent as rent_inr,
  e.bhk,
  a.label as area_label,
  null::text as move_in_month,
  null::text as broker_or_owner,
  e.furnishing,
  null::integer as maintenance_inr,
  null::integer as deposit_inr,
  false as opt_in_building_aggregate,
  false as women_only,
  dev.h as device_id_hash,
  false as reported,
  e.created_at,
  case
    when exists (
      select 1 from public.rent_sources v
      where v.rent_entry_id = e.id and v.verified
    ) then 'verified_document'::text
    when coalesce(cc.cnt, 0) >= 1 then 'self-reported'::text
    else 'unverified'::text
  end as verification_status,
  coalesce(cc.cnt, 0)::integer as confirmations_count,
  coalesce(cc.last_at, e.created_at) as last_updated
from public.rent_entries e
join public.areas a on a.id = e.area_id
left join lateral (
  select rs.submitter_device_hash as h
  from public.rent_sources rs
  where rs.rent_entry_id = e.id
    and rs.submitter_device_hash is not null
  order by case when rs.source_type = 'user' then 0 else 1 end, rs.created_at desc nulls last, rs.id
  limit 1
) dev on true
left join lateral (
  select
    count(*)::integer as cnt,
    max(vl.created_at) as last_at
  from public.verification_logs vl
  where vl.rent_entry_id = e.id
    and vl.action = 'confirmed'
) cc on true;

comment on view public.rent_entries_expanded is 'Map/API compatibility row (legacy names including rent_inr).';

grant select on public.rent_entries_expanded to anon, authenticated, service_role;

create or replace function public.rents_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  since_iso timestamptz
)
returns setof public.rent_entries_expanded
language sql
stable
as $$
  select ex.*
  from public.rent_entries_expanded ex
  join public.rent_entries re on re.id = ex.id
  join public.areas a on a.id = re.area_id
  where a.geom && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    and ex.created_at >= since_iso;
$$;

comment on function public.rents_in_bbox is 'Viewport fetch via areas.geom; returns rent_entries_expanded rows.';

grant execute on function public.rents_in_bbox(
  double precision,
  double precision,
  double precision,
  double precision,
  timestamptz
) to anon, authenticated;

-- ============================================================
-- 010_spatial_ref_sys_rls.sql — RLS on PostGIS spatial_ref_sys (conditional)
-- ============================================================
do $rls$
declare
  is_super boolean;
  is_owner boolean;
begin
  if to_regclass('public.spatial_ref_sys') is null then
    return;
  end if;

  select rolsuper into is_super from pg_roles where rolname = current_user;
  select (c.relowner = (select oid from pg_roles where rolname = current_user))
  into is_owner
  from pg_class c
  where c.oid = 'public.spatial_ref_sys'::regclass;

  if coalesce(is_super, false) or coalesce(is_owner, false) then
    alter table public.spatial_ref_sys enable row level security;
    drop policy if exists "spatial_ref_sys_select" on public.spatial_ref_sys;
    create policy "spatial_ref_sys_select"
      on public.spatial_ref_sys
      for select
      using (true);
    comment on table public.spatial_ref_sys is
      'PostGIS SRID catalog; RLS + read-only policy for Supabase security checks.';
  else
    raise notice '010_spatial_ref_sys_rls: skipped (not owner/superuser). Run scripts/fix-spatial-ref-sys-rls.sql via direct postgres:5432.';
  end if;
end
$rls$;

-- ============================================================
-- 011_rent_history.sql
-- ============================================================
-- Time-series rent observations for trends, seasonality, and future models.
-- One row per snapshot: new pin (insert) or rent amount change (update).

create table if not exists public.rent_history (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas (id) on delete cascade,
  bhk text not null,
  rent integer not null check (rent > 0 and rent < 5000000),
  recorded_at timestamptz not null default now(),
  rent_entry_id uuid references public.rent_entries (id) on delete set null
);

create index if not exists idx_rent_history_area_time
  on public.rent_history (area_id, recorded_at desc);

create index if not exists idx_rent_history_time
  on public.rent_history (recorded_at desc);

create index if not exists idx_rent_history_entry
  on public.rent_history (rent_entry_id);

comment on table public.rent_history is 'Append-only rent snapshots over time (area + BHK + rent + recorded_at).';

alter table public.rent_history enable row level security;
drop policy if exists "rent_history public read" on public.rent_history;
create policy "rent_history public read"
  on public.rent_history for select
  using (true);

-- Initial snapshot per existing pin (idempotent).
insert into public.rent_history (area_id, bhk, rent, recorded_at, rent_entry_id)
select re.area_id, re.bhk, re.rent, re.created_at, re.id
from public.rent_entries re
where not exists (
  select 1
  from public.rent_history h
  where h.rent_entry_id = re.id
);

create or replace function public.rent_entry_append_history()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.rent_history (area_id, bhk, rent, recorded_at, rent_entry_id)
    values (
      new.area_id,
      new.bhk,
      new.rent,
      coalesce(new.created_at, now()),
      new.id
    );
    return new;
  end if;
  if tg_op = 'UPDATE' and old.rent is distinct from new.rent then
    insert into public.rent_history (area_id, bhk, rent, recorded_at, rent_entry_id)
    values (new.area_id, new.bhk, new.rent, now(), new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rent_entry_history on public.rent_entries;
create trigger trg_rent_entry_history
  after insert or update of rent on public.rent_entries
  for each row
  execute function public.rent_entry_append_history();

-- Monthly medians in viewport (for charts / seasonality).
create or replace function public.rent_history_monthly_medians(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  since_iso timestamptz,
  bhk_filter text default null
)
returns table (
  month_key text,
  median_rent double precision,
  pin_count bigint
)
language sql
stable
as $$
  select
    to_char(date_trunc('month', h.recorded_at), 'YYYY-MM') as month_key,
    percentile_cont(0.5) within group (order by h.rent::double precision) as median_rent,
    count(*)::bigint as pin_count
  from public.rent_history h
  join public.areas a on a.id = h.area_id
  where a.geom && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    and h.recorded_at >= since_iso
    and (
      bhk_filter is null
      or trim(bhk_filter) = ''
      or h.bhk = bhk_filter
    )
  group by 1
  order by 1;
$$;

comment on function public.rent_history_monthly_medians is 'Median rent by calendar month inside bbox; optional BHK filter.';

grant execute on function public.rent_history_monthly_medians(
  double precision,
  double precision,
  double precision,
  double precision,
  timestamptz,
  text
) to anon, authenticated;

-- ============================================================
-- 019_rent_crowdsource_insert_rls.sql — INSERT RLS + grants
-- ============================================================
alter table public.rent_entries enable row level security;

drop policy if exists "Allow insert for authenticated users" on public.rent_entries;
create policy "Allow insert for authenticated users"
  on public.rent_entries
  for insert
  to authenticated
  with check (auth.uid() is not null);

drop policy if exists "Allow all inserts" on public.rent_entries;
create policy "Allow all inserts"
  on public.rent_entries
  for insert
  to anon
  with check (true);

alter table public.areas enable row level security;

drop policy if exists "Allow insert for authenticated users" on public.areas;
create policy "Allow insert for authenticated users"
  on public.areas
  for insert
  to authenticated
  with check (auth.uid() is not null);

drop policy if exists "Allow all inserts" on public.areas;
create policy "Allow all inserts"
  on public.areas
  for insert
  to anon
  with check (true);

alter table public.rent_sources enable row level security;

drop policy if exists "Allow insert for authenticated users" on public.rent_sources;
create policy "Allow insert for authenticated users"
  on public.rent_sources
  for insert
  to authenticated
  with check (auth.uid() is not null);

drop policy if exists "Allow all inserts" on public.rent_sources;
create policy "Allow all inserts"
  on public.rent_sources
  for insert
  to anon
  with check (true);

alter table public.rent_history enable row level security;

drop policy if exists "Allow insert for authenticated users" on public.rent_history;
create policy "Allow insert for authenticated users"
  on public.rent_history
  for insert
  to authenticated
  with check (auth.uid() is not null);

drop policy if exists "Allow all inserts" on public.rent_history;
create policy "Allow all inserts"
  on public.rent_history
  for insert
  to anon
  with check (true);

grant insert on public.areas to anon, authenticated;
grant insert on public.rent_entries to anon, authenticated;
grant insert on public.rent_sources to anon, authenticated;
grant insert on public.rent_history to anon, authenticated;

-- ============================================================
-- 020_rent_entries_realtime.sql — publication for INSERT events
-- ============================================================
do $pub$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rent_entries'
  ) then
    execute 'alter publication supabase_realtime add table public.rent_entries';
  end if;
end
$pub$;

-- ============================================================
-- 021_seeker_pins_step5_spec.sql — minimal seeker_pins if absent
-- ============================================================
do $step5$
begin
  if to_regclass('public.seeker_pins') is not null then
    raise notice 'public.seeker_pins already exists — see 012_seeker_pin_auth_step1.sql';
    return;
  end if;

  create table public.seeker_pins (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users (id),
    lat double precision not null,
    lng double precision not null,
    budget integer,
    bhk integer,
    move_in text,
    created_at timestamptz not null default now()
  );

  comment on table public.seeker_pins is 'Seeker demand pins (STEP 5 minimal shape).';
end
$step5$;

-- ============================================================
-- 022_seeker_pins_rls_public_read_auth_insert.sql
-- ============================================================
alter table public.seeker_pins enable row level security;

drop policy if exists "seeker_pins public read active" on public.seeker_pins;
drop policy if exists "seeker_pins owner read inactive" on public.seeker_pins;
drop policy if exists "seeker_pins_public_read" on public.seeker_pins;

create policy "seeker_pins_public_read"
  on public.seeker_pins
  for select
  to anon, authenticated
  using (true);

drop policy if exists "seeker_pins insert own" on public.seeker_pins;
drop policy if exists "seeker_pins insert_authenticated" on public.seeker_pins;

create policy "seeker_pins_insert_authenticated"
  on public.seeker_pins
  for insert
  to authenticated
  with check (auth.uid() is not null and auth.uid() = user_id);

-- ============================================================
-- 023_seeker_pins_realtime.sql — publication for seeker_pins
-- ============================================================
do $pub$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'seeker_pins'
  ) then
    execute 'alter publication supabase_realtime add table public.seeker_pins';
  end if;
end
$pub$;

-- ============================================================
-- 024_rent_entries_public_read_ensure.sql — public read policy
-- ============================================================
alter table if exists public.rent_entries enable row level security;

drop policy if exists "Allow public read" on public.rent_entries;

create policy "Allow public read"
  on public.rent_entries
  for select
  using (true);

grant select on table public.rent_entries to anon, authenticated;
