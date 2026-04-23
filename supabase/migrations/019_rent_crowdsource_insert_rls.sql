-- 019: INSERT RLS for crowdsourced rent flow (areas → rent_entries → rent_sources).
-- service_role bypasses RLS; these policies fix anon / authenticated client writes.
-- rent_entry_append_history() runs as the inserting user — rent_history needs insert too.

-- ---------------------------------------------------------------------------
-- rent_entries
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- areas (same-session insert before rent_entries)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- rent_sources
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- rent_history (trigger after rent_entries insert/update; invoker = inserter)
-- ---------------------------------------------------------------------------
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
