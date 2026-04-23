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
