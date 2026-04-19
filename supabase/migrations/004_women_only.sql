alter table public.rent_entries
  add column if not exists women_only boolean not null default false;

comment on column public.rent_entries.women_only is 'Self-reported female-hosted / women-only space; used for map filter.';
