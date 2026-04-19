-- Reporting + posting bans (anonymous device_id_hash on rent_entries)

create table if not exists public.banned_posting_devices (
  device_id_hash text primary key,
  reason text,
  created_at timestamptz not null default now()
);

comment on table public.banned_posting_devices is 'Anonymous devices blocked from new submissions after abuse threshold.';

create table if not exists public.rent_reports (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.rent_entries (id) on delete cascade,
  reporter_device_hash text not null,
  created_at timestamptz not null default now(),
  unique (entry_id, reporter_device_hash)
);

create index if not exists idx_rent_reports_entry on public.rent_reports (entry_id);
create index if not exists idx_rent_reports_reporter on public.rent_reports (reporter_device_hash);

comment on table public.rent_reports is 'Anonymous reports; multiple reporters can flag one pin.';
