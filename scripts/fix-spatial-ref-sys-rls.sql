-- =============================================================================
-- Fix Supabase: "must be owner of table spatial_ref_sys" when enabling RLS
-- in Table Editor, and clear Security Advisor "RLS disabled in public".
--
-- Why: PostGIS creates spatial_ref_sys owned by the extension superuser, not
-- the pooled Dashboard role, so ALTER ... ENABLE ROW LEVEL SECURITY fails.
--
-- How (Supabase hosted):
--   1. Dashboard → Project Settings → Database → copy the connection string
--      that uses port 5432 (direct), NOT 6543 (transaction pooler).
--   2. Use the "postgres" user password (reset in Database settings if needed).
--   3. From your machine:
--        psql "postgresql://postgres:YOUR_PASSWORD@db.<project-ref>.supabase.co:5432/postgres" -f scripts/fix-spatial-ref-sys-rls.sql
--
-- This script runs as superuser: transfers ownership to postgres, enables RLS,
-- and adds a read-only SELECT policy (PostGIS still works for SRID lookups).
-- =============================================================================

alter table if exists public.spatial_ref_sys owner to postgres;

alter table if exists public.spatial_ref_sys enable row level security;

drop policy if exists "spatial_ref_sys_select" on public.spatial_ref_sys;
create policy "spatial_ref_sys_select"
  on public.spatial_ref_sys
  for select
  using (true);

comment on table public.spatial_ref_sys is
  'PostGIS SRID catalog; RLS + read-only policy for Supabase security checks.';
