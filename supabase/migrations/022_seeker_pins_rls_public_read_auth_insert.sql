-- STEP 6 — seeker_pins RLS: public read, authenticated insert (own user_id).
-- Replaces narrow SELECT policies from 013 with full public read per spec.

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
