-- =============================================================================
-- STEP 2 — Row Level Security: seeker_pins, seeker_preferences, matches,
-- contact_requests (auth.uid(), anon public read for active pins only).
-- Run after 012_seeker_pin_auth_step1.sql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- seeker_pins
-- ---------------------------------------------------------------------------
alter table public.seeker_pins enable row level security;

drop policy if exists "seeker_pins insert own" on public.seeker_pins;
create policy "seeker_pins insert own"
  on public.seeker_pins
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "seeker_pins update own" on public.seeker_pins;
create policy "seeker_pins update own"
  on public.seeker_pins
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "seeker_pins delete own" on public.seeker_pins;
create policy "seeker_pins delete own"
  on public.seeker_pins
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "seeker_pins public read active" on public.seeker_pins;
create policy "seeker_pins public read active"
  on public.seeker_pins
  for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "seeker_pins owner read inactive" on public.seeker_pins;
create policy "seeker_pins owner read inactive"
  on public.seeker_pins
  for select
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- seeker_preferences (pin owner only)
-- ---------------------------------------------------------------------------
alter table public.seeker_preferences enable row level security;

drop policy if exists "seeker_preferences owner select" on public.seeker_preferences;
create policy "seeker_preferences owner select"
  on public.seeker_preferences
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.seeker_pins sp
      where sp.id = seeker_preferences.seeker_id
        and sp.user_id = auth.uid()
    )
  );

drop policy if exists "seeker_preferences owner insert" on public.seeker_preferences;
create policy "seeker_preferences owner insert"
  on public.seeker_preferences
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.seeker_pins sp
      where sp.id = seeker_preferences.seeker_id
        and sp.user_id = auth.uid()
    )
  );

drop policy if exists "seeker_preferences owner update" on public.seeker_preferences;
create policy "seeker_preferences owner update"
  on public.seeker_preferences
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.seeker_pins sp
      where sp.id = seeker_preferences.seeker_id
        and sp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.seeker_pins sp
      where sp.id = seeker_preferences.seeker_id
        and sp.user_id = auth.uid()
    )
  );

drop policy if exists "seeker_preferences owner delete" on public.seeker_preferences;
create policy "seeker_preferences owner delete"
  on public.seeker_preferences
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.seeker_pins sp
      where sp.id = seeker_preferences.seeker_id
        and sp.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- matches — involved users read; backend / jobs insert & update (service_role)
-- ---------------------------------------------------------------------------
alter table public.matches enable row level security;

drop policy if exists "matches involved select" on public.matches;
create policy "matches involved select"
  on public.matches
  for select
  to authenticated
  using (
    auth.uid() = (
      select sp.user_id
      from public.seeker_pins sp
      where sp.id = matches.seeker_id
    )
    or auth.uid() = matched_user_id
  );

drop policy if exists "matches service role all" on public.matches;
create policy "matches service role all"
  on public.matches
  for all
  to service_role
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- contact_requests — pin owner & responder read; responder inserts & updates
-- ---------------------------------------------------------------------------
alter table public.contact_requests enable row level security;

drop policy if exists "contact_requests parties select" on public.contact_requests;
create policy "contact_requests parties select"
  on public.contact_requests
  for select
  to authenticated
  using (
    auth.uid() = responder_id
    or exists (
      select 1
      from public.seeker_pins sp
      where sp.id = contact_requests.seeker_id
        and sp.user_id = auth.uid()
    )
  );

drop policy if exists "contact_requests responder insert" on public.contact_requests;
create policy "contact_requests responder insert"
  on public.contact_requests
  for insert
  to authenticated
  with check (
    auth.uid() = responder_id
    and exists (
      select 1
      from public.seeker_pins sp
      where sp.id = contact_requests.seeker_id
        and sp.user_id <> auth.uid()
    )
  );

drop policy if exists "contact_requests responder update status" on public.contact_requests;
create policy "contact_requests responder update status"
  on public.contact_requests
  for update
  to authenticated
  using (auth.uid() = responder_id)
  with check (auth.uid() = responder_id);

-- Optional: match worker / admin using service key
drop policy if exists "contact_requests service role all" on public.contact_requests;
create policy "contact_requests service role all"
  on public.contact_requests
  for all
  to service_role
  using (true)
  with check (true);

-- Prevent privilege escalation: responder may only change status (not parties).
create or replace function public.contact_requests_lock_parties()
returns trigger
language plpgsql
as $$
begin
  if new.seeker_id is distinct from old.seeker_id
    or new.responder_id is distinct from old.responder_id
  then
    raise exception 'seeker_id and responder_id are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_contact_requests_lock_parties on public.contact_requests;
create trigger trg_contact_requests_lock_parties
  before update on public.contact_requests
  for each row
  execute function public.contact_requests_lock_parties();

-- -----------------------------------------------------------------------------
-- Verification (run manually in SQL editor after migration)
-- -----------------------------------------------------------------------------
-- select c.relname, c.relrowsecurity as rls_on
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public'
--   and c.relname in ('seeker_pins','seeker_preferences','matches','contact_requests')
-- order by 1;
--
-- select tablename, policyname, roles, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('seeker_pins','seeker_preferences','matches','contact_requests')
-- order by tablename, policyname;
