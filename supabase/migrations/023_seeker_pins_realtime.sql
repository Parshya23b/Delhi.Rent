-- Realtime: seeker_pins INSERT/UPDATE/DELETE for live map + match UI.
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
      and tablename = 'seeker_pins'
  ) then
    execute 'alter publication supabase_realtime add table public.seeker_pins';
  end if;
end
$pub$;
