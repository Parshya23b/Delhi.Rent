alter table public.rent_entries
  add column if not exists maintenance_inr integer,
  add column if not exists deposit_inr integer,
  add column if not exists opt_in_building_aggregate boolean not null default false;

comment on column public.rent_entries.maintenance_inr is 'Optional monthly society/CAM';
comment on column public.rent_entries.deposit_inr is 'Optional one-time security deposit';
comment on column public.rent_entries.opt_in_building_aggregate is 'User opted into fuzzy building-level stats';

-- Future: append-only history for median-over-time analytics
-- create table public.rent_snapshots (...);
