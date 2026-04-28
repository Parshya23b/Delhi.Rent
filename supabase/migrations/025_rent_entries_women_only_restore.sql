-- Restore women_only on rent_entries and surface it in rent_entries_expanded.
-- Migration 009 dropped the column and hardcoded false in the view, which broke
-- the map "Women-only spaces" filter (all pins looked non–women-only).

alter table public.rent_entries
  add column if not exists women_only boolean not null default false;

comment on column public.rent_entries.women_only is
  'Self-reported female-hosted / women-only space; used for map filter.';

create or replace view public.rent_entries_expanded as
select
  e.id,
  a.lat,
  a.lng,
  e.rent as rent_inr,
  e.bhk,
  a.label as area_label,
  null::text as move_in_month,
  null::text as broker_or_owner,
  e.furnishing,
  null::integer as maintenance_inr,
  null::integer as deposit_inr,
  false as opt_in_building_aggregate,
  coalesce(e.women_only, false) as women_only,
  dev.h as device_id_hash,
  false as reported,
  e.created_at,
  case
    when exists (
      select 1 from public.rent_sources v
      where v.rent_entry_id = e.id and v.verified
    ) then 'verified_document'::text
    when coalesce(cc.cnt, 0) >= 1 then 'self-reported'::text
    else 'unverified'::text
  end as verification_status,
  coalesce(cc.cnt, 0)::integer as confirmations_count,
  coalesce(cc.last_at, e.created_at) as last_updated
from public.rent_entries e
join public.areas a on a.id = e.area_id
left join lateral (
  select rs.submitter_device_hash as h
  from public.rent_sources rs
  where rs.rent_entry_id = e.id
    and rs.submitter_device_hash is not null
  order by case when rs.source_type = 'user' then 0 else 1 end, rs.created_at desc nulls last, rs.id
  limit 1
) dev on true
left join lateral (
  select
    count(*)::integer as cnt,
    max(vl.created_at) as last_at
  from public.verification_logs vl
  where vl.rent_entry_id = e.id
    and vl.action = 'confirmed'
) cc on true;

comment on view public.rent_entries_expanded is 'Map/API compatibility row (legacy names including rent_inr).';

grant select on public.rent_entries_expanded to anon, authenticated, service_role;
