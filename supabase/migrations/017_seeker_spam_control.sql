-- =============================================================================
-- STEP 8 — Data safety: near-duplicate pins per user + max 3 pins per user
-- (SQL triggers / indexes; contact verification in 018.)
-- =============================================================================

-- Same user cannot drop two pins at the same rounded coordinates (spam / double-submit).
create unique index if not exists seeker_pins_user_geo_round_uidx
  on public.seeker_pins (
    user_id,
    (round(lat::numeric, 6)),
    (round(lng::numeric, 6))
  );

create or replace function public.seeker_pins_quota_check()
returns trigger
language plpgsql
as $$
declare
  n integer;
begin
  select count(*)::integer into n from public.seeker_pins where user_id = new.user_id;
  if n >= 3 then
    raise exception 'seeker_pins: maximum 3 pins per user'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_seeker_pins_quota_check on public.seeker_pins;
create trigger trg_seeker_pins_quota_check
  before insert on public.seeker_pins
  for each row
  execute function public.seeker_pins_quota_check();

comment on function public.seeker_pins_quota_check() is
  'Enforces max 3 seeker_pins rows per user_id (before insert).';
