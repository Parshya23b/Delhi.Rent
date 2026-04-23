-- PostGIS owns public.spatial_ref_sys; Table Editor "postgres" often gets 42501 (not owner).
-- Applies RLS only when this migration runs as owner or superuser; otherwise no-op + NOTICE.
-- Complete fix: scripts/fix-spatial-ref-sys-rls.sql via direct postgres:5432 (see file header).

do $rls$
declare
  is_super boolean;
  is_owner boolean;
begin
  if to_regclass('public.spatial_ref_sys') is null then
    return;
  end if;

  select rolsuper into is_super from pg_roles where rolname = current_user;
  select (c.relowner = (select oid from pg_roles where rolname = current_user))
  into is_owner
  from pg_class c
  where c.oid = 'public.spatial_ref_sys'::regclass;

  if coalesce(is_super, false) or coalesce(is_owner, false) then
    alter table public.spatial_ref_sys enable row level security;
    drop policy if exists "spatial_ref_sys_select" on public.spatial_ref_sys;
    create policy "spatial_ref_sys_select"
      on public.spatial_ref_sys
      for select
      using (true);
    comment on table public.spatial_ref_sys is
      'PostGIS SRID catalog; RLS + read-only policy for Supabase security checks.';
  else
    raise notice '010_spatial_ref_sys_rls: skipped (not owner/superuser). Run scripts/fix-spatial-ref-sys-rls.sql via direct postgres:5432.';
  end if;
end
$rls$;
