-- Seeker pins: people looking for a flat or room who want to be matched with
-- flatmates / owners. Keeps email + phone private (never exposed via RLS reads).

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
  -- Contact is private. Never return these via the public anon role.
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

-- If PostGIS is enabled (see 005_postgis_bbox.sql), add a geometry column + GiST index.
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
