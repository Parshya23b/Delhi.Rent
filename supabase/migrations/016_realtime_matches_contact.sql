-- =============================================================================
-- STEP 7 — Supabase Realtime: matches + contact_requests
-- Requires publication `supabase_realtime` (Supabase hosted default).
-- REPLICA IDENTITY FULL improves postgres_changes payloads on UPDATE.
-- =============================================================================

alter table if exists public.matches replica identity full;
alter table if exists public.contact_requests replica identity full;

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
      and tablename = 'matches'
  ) then
    execute 'alter publication supabase_realtime add table public.matches';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'contact_requests'
  ) then
    execute 'alter publication supabase_realtime add table public.contact_requests';
  end if;
end
$pub$;
