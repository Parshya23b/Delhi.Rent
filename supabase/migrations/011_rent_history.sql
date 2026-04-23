-- Time-series rent observations for trends, seasonality, and future models.
-- One row per snapshot: new pin (insert) or rent amount change (update).

create table if not exists public.rent_history (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas (id) on delete cascade,
  bhk text not null,
  rent integer not null check (rent > 0 and rent < 5000000),
  recorded_at timestamptz not null default now(),
  rent_entry_id uuid references public.rent_entries (id) on delete set null
);

create index if not exists idx_rent_history_area_time
  on public.rent_history (area_id, recorded_at desc);

create index if not exists idx_rent_history_time
  on public.rent_history (recorded_at desc);

create index if not exists idx_rent_history_entry
  on public.rent_history (rent_entry_id);

comment on table public.rent_history is 'Append-only rent snapshots over time (area + BHK + rent + recorded_at).';

alter table public.rent_history enable row level security;
drop policy if exists "rent_history public read" on public.rent_history;
create policy "rent_history public read"
  on public.rent_history for select
  using (true);

-- Initial snapshot per existing pin (idempotent).
insert into public.rent_history (area_id, bhk, rent, recorded_at, rent_entry_id)
select re.area_id, re.bhk, re.rent, re.created_at, re.id
from public.rent_entries re
where not exists (
  select 1
  from public.rent_history h
  where h.rent_entry_id = re.id
);

create or replace function public.rent_entry_append_history()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.rent_history (area_id, bhk, rent, recorded_at, rent_entry_id)
    values (
      new.area_id,
      new.bhk,
      new.rent,
      coalesce(new.created_at, now()),
      new.id
    );
    return new;
  end if;
  if tg_op = 'UPDATE' and old.rent is distinct from new.rent then
    insert into public.rent_history (area_id, bhk, rent, recorded_at, rent_entry_id)
    values (new.area_id, new.bhk, new.rent, now(), new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rent_entry_history on public.rent_entries;
create trigger trg_rent_entry_history
  after insert or update of rent on public.rent_entries
  for each row
  execute function public.rent_entry_append_history();

-- Monthly medians in viewport (for charts / seasonality).
create or replace function public.rent_history_monthly_medians(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  since_iso timestamptz,
  bhk_filter text default null
)
returns table (
  month_key text,
  median_rent double precision,
  pin_count bigint
)
language sql
stable
as $$
  select
    to_char(date_trunc('month', h.recorded_at), 'YYYY-MM') as month_key,
    percentile_cont(0.5) within group (order by h.rent::double precision) as median_rent,
    count(*)::bigint as pin_count
  from public.rent_history h
  join public.areas a on a.id = h.area_id
  where a.geom && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    and h.recorded_at >= since_iso
    and (
      bhk_filter is null
      or trim(bhk_filter) = ''
      or h.bhk = bhk_filter
    )
  group by 1
  order by 1;
$$;

comment on function public.rent_history_monthly_medians is 'Median rent by calendar month inside bbox; optional BHK filter.';

grant execute on function public.rent_history_monthly_medians(
  double precision,
  double precision,
  double precision,
  double precision,
  timestamptz,
  text
) to anon, authenticated;
