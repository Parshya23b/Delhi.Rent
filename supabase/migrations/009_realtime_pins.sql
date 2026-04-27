-- Optional: broadcast INSERT/UPDATE on pins to Realtime clients.
-- Safe to re-run: ignores duplicate_object if already added.

do $rl$
begin
  execute 'alter publication supabase_realtime add table public.pins';
exception
  when duplicate_object then
    null;
  when insufficient_privilege then
    raise notice 'Skipping realtime add (insufficient privileges). Add pins manually in Dashboard → Replication.';
end;
$rl$;
