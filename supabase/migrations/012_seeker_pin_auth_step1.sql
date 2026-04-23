-- =============================================================================
-- STEP 1 — Auth-backed Seeker Pin system (Dilli.rent / delhi.rent)
-- Supabase: PostgreSQL + auth.users. No Prisma. Schema + indexes only (no RLS).
--
-- CONFLICT: Replaces legacy anonymous public.seeker_pins from migration 007.
-- Before running in production: back up 007 data if needed, then run this once.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Legacy 007 cleanup (view depends on table)
-- ---------------------------------------------------------------------------
drop view if exists public.seeker_pins_public;
drop table if exists public.seeker_pins cascade;

-- ---------------------------------------------------------------------------
-- ENUM types
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'seeker_intent_type') then
    create type public.seeker_intent_type as enum ('whole_flat', 'room');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'seeker_move_in') then
    create type public.seeker_move_in as enum ('asap', 'next_month', 'flexible');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'seeker_food_pref') then
    create type public.seeker_food_pref as enum ('veg', 'non_veg', 'any');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'seeker_smoking_pref') then
    create type public.seeker_smoking_pref as enum ('smoker', 'non_smoker', 'no_preference');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'seeker_gender') then
    create type public.seeker_gender as enum ('male', 'female', 'other');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'seeker_preferred_gender') then
    create type public.seeker_preferred_gender as enum ('male', 'female', 'any');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'seeker_sleep_pattern') then
    create type public.seeker_sleep_pattern as enum ('early', 'late', 'flexible');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'seeker_work_type') then
    create type public.seeker_work_type as enum ('wfh', 'office', 'hybrid');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'seeker_social_level') then
    create type public.seeker_social_level as enum ('quiet', 'moderate', 'social');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'seeker_cleanliness_level') then
    create type public.seeker_cleanliness_level as enum ('low', 'medium', 'high');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'seeker_match_status') then
    create type public.seeker_match_status as enum ('pending', 'accepted', 'rejected');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'seeker_contact_request_status') then
    create type public.seeker_contact_request_status as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- TABLE: seeker_pins
-- ---------------------------------------------------------------------------
create table public.seeker_pins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  radius_km integer not null default 2 check (radius_km > 0 and radius_km <= 100),
  intent_type public.seeker_intent_type not null,
  budget integer not null check (budget >= 0),
  bhk_preference integer null check (bhk_preference is null or (bhk_preference >= 0 and bhk_preference <= 10)),
  move_in public.seeker_move_in not null default 'flexible',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.seeker_pins is 'Logged-in user seeker pin: location + budget/BHK intent for matching.';

create index seeker_pins_lat_lng_idx on public.seeker_pins (lat, lng);
create index seeker_pins_budget_idx on public.seeker_pins (budget);
create index seeker_pins_user_id_idx on public.seeker_pins (user_id);
create index seeker_pins_active_idx on public.seeker_pins (is_active) where is_active = true;

-- ---------------------------------------------------------------------------
-- TABLE: seeker_preferences (1:1 extension row per pin)
-- ---------------------------------------------------------------------------
create table public.seeker_preferences (
  id uuid primary key default gen_random_uuid(),
  seeker_id uuid not null references public.seeker_pins (id) on delete cascade,
  food_pref public.seeker_food_pref not null default 'any',
  smoking_pref public.seeker_smoking_pref not null default 'no_preference',
  gender public.seeker_gender not null,
  preferred_gender public.seeker_preferred_gender not null default 'any',
  sleep_pattern public.seeker_sleep_pattern not null default 'flexible',
  work_type public.seeker_work_type not null default 'hybrid',
  social_level public.seeker_social_level not null default 'moderate',
  cleanliness_level public.seeker_cleanliness_level not null default 'medium'
);

comment on table public.seeker_preferences is 'Lifestyle prefs for a seeker pin; private to owner + match flows.';

create unique index seeker_preferences_one_per_pin on public.seeker_preferences (seeker_id);

-- ---------------------------------------------------------------------------
-- TABLE: matches (property pin and/or flatmate user)
-- property_id → existing listing table rent_entries (this repo has no separate "properties" table)
-- ---------------------------------------------------------------------------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  seeker_id uuid not null references public.seeker_pins (id) on delete cascade,
  property_id uuid null references public.rent_entries (id) on delete set null,
  matched_user_id uuid null references auth.users (id) on delete set null,
  match_score double precision not null default 0,
  status public.seeker_match_status not null default 'pending',
  created_at timestamptz not null default now()
);

comment on table public.matches is 'Suggested links from a seeker pin to a rent listing and/or another user.';

create index matches_seeker_id_idx on public.matches (seeker_id);
create index matches_property_id_idx on public.matches (property_id) where property_id is not null;
create index matches_matched_user_id_idx on public.matches (matched_user_id) where matched_user_id is not null;
create index matches_status_idx on public.matches (status);

-- ---------------------------------------------------------------------------
-- TABLE: contact_requests (private responses / intros)
-- ---------------------------------------------------------------------------
create table public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  seeker_id uuid not null references public.seeker_pins (id) on delete cascade,
  responder_id uuid not null references auth.users (id) on delete cascade,
  status public.seeker_contact_request_status not null default 'pending',
  created_at timestamptz not null default now()
);

comment on table public.contact_requests is 'A user requests contact with a seeker pin; approval gates private details.';

create index contact_requests_seeker_id_idx on public.contact_requests (seeker_id);
create index contact_requests_responder_id_idx on public.contact_requests (responder_id);
create index contact_requests_status_idx on public.contact_requests (status);
