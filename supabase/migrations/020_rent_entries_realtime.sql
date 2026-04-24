-- Realtime: new rent pins (INSERT) for client subscriptions.
-- Requires publication `supabase_realtime` (Supabase hosted default).

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
