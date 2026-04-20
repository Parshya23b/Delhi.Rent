-- Confidence score system: verification status + user confirmations per pin

alter table public.rent_entries
  add column if not exists verification_status text not null default 'self-reported',
  add column if not exists confirmations_count integer not null default 0,
  add column if not exists last_updated timestamptz not null default now();

alter table public.rent_entries
  drop constraint if exists rent_entries_verification_status_check;

alter table public.rent_entries
  add constraint rent_entries_verification_status_check
  check (verification_status in ('unverified', 'self-reported', 'verified_document'));

comment on column public.rent_entries.verification_status is 'Trust level: unverified | self-reported | verified_document';
comment on column public.rent_entries.confirmations_count is 'Unique devices that confirmed this pin is still accurate';
comment on column public.rent_entries.last_updated is 'Bumps on author edit or user confirmation';

-- Confirmations: unique per (entry, confirmer) to prevent spam
create table if not exists public.rent_confirmations (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.rent_entries (id) on delete cascade,
  confirmer_device_hash text not null,
  confirmer_ip_hash text,
  created_at timestamptz not null default now(),
  unique (entry_id, confirmer_device_hash)
);

create index if not exists idx_rent_confirmations_entry
  on public.rent_confirmations (entry_id);

create index if not exists idx_rent_confirmations_ip_recent
  on public.rent_confirmations (confirmer_ip_hash, created_at desc);

-- Trigger keeps confirmations_count + last_updated in sync
create or replace function public.rent_entry_after_confirm()
returns trigger
language plpgsql
as $$
begin
  update public.rent_entries
  set confirmations_count = confirmations_count + 1,
      last_updated = now()
  where id = new.entry_id;
  return new;
end;
$$;

drop trigger if exists trg_rent_confirmation_bump on public.rent_confirmations;
create trigger trg_rent_confirmation_bump
  after insert on public.rent_confirmations
  for each row
  execute function public.rent_entry_after_confirm();

-- Backfill for rows created before this migration: new default applies to inserts;
-- existing rows keep verification_status='self-reported' (the new default) via
-- the ALTER TABLE default — but in case older rows sit as NULL in any environment:
update public.rent_entries
set verification_status = coalesce(verification_status, 'self-reported'),
    confirmations_count = coalesce(confirmations_count, 0),
    last_updated = coalesce(last_updated, created_at, now())
where verification_status is null
   or confirmations_count is null
   or last_updated is null;

comment on table public.rent_confirmations is
  'One row per device/session that confirmed a rent pin still accurate (anti-spam: unique per device).';
