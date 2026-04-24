-- STEP 5 — Minimal seeker_pins (user spec).
-- This repo’s main definition is 012_seeker_pin_auth_step1.sql (auth, radius_km, enums, etc.).
-- This migration only runs the DDL below when public.seeker_pins does not exist yet.

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
