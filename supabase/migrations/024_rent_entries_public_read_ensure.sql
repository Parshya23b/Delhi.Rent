-- 024: Re-assert public SELECT on rent_entries (safe if production DB lost the 001 policy).

alter table if exists public.rent_entries enable row level security;

drop policy if exists "Allow public read" on public.rent_entries;

create policy "Allow public read"
  on public.rent_entries
  for select
  using (true);

grant select on table public.rent_entries to anon, authenticated;
