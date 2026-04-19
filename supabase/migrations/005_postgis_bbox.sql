-- PostGIS: spatial index + bbox queries for map loading at scale

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

-- Bbox query: uses GiST index; envelope in WGS84
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
