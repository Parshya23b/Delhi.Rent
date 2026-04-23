-- =============================================================================
-- STEP 4 — RPC: request_contact(seeker_id uuid, responder_id uuid)
-- Inserts contact_requests (responder → seeker pin). Deduplicates by
-- (seeker_id, responder_id): returns existing row status on conflict.
-- seeker_id = public.seeker_pins.id (the pin row), not auth.users.
--
-- PostgREST / supabase-js:
--   .rpc('request_contact', { seeker_id: '<pin-uuid>', responder_id: authUserId })
-- responder_id must equal the caller’s auth.uid() (validated in SQL).
-- Run after 012 + 013 (+ 014 optional).
-- =============================================================================

-- One row per (pin, responder) so duplicate requests are idempotent.
delete from public.contact_requests a
where exists (
  select 1
  from public.contact_requests b
  where b.seeker_id = a.seeker_id
    and b.responder_id = a.responder_id
    and b.id < a.id
);

create unique index if not exists contact_requests_seeker_responder_uidx
  on public.contact_requests (seeker_id, responder_id);

create or replace function public.request_contact(seeker_id uuid, responder_id uuid)
returns public.seeker_contact_request_status
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pin_id uuid := seeker_id;
  r_id uuid := responder_id;
  v_uid uuid;
  v_role text;
  v_is_service boolean;
  v_pin record;
  v_status public.seeker_contact_request_status;
begin
  v_uid := auth.uid();
  v_role := coalesce(auth.jwt() ->> 'role', '');
  v_is_service := v_role = 'service_role';

  if not v_is_service then
    if v_uid is null then
      raise exception 'request_contact: authentication required';
    end if;
    if r_id is distinct from v_uid then
      raise exception 'request_contact: responder_id must match the signed-in user';
    end if;
  end if;

  select * into v_pin
  from public.seeker_pins sp
  where sp.id = pin_id;

  if not found then
    raise exception 'request_contact: seeker pin not found';
  end if;

  if not v_is_service and v_pin.user_id is not distinct from r_id then
    raise exception 'request_contact: cannot request contact on your own pin';
  end if;

  insert into public.contact_requests (seeker_id, responder_id, status)
  values (pin_id, r_id, 'pending'::public.seeker_contact_request_status)
  on conflict (seeker_id, responder_id) do nothing;

  select cr.status into v_status
  from public.contact_requests cr
  where cr.seeker_id = pin_id
    and cr.responder_id = r_id;

  if v_status is null then
    raise exception 'request_contact: unexpected — row missing after insert';
  end if;

  return v_status;
end;
$$;

comment on function public.request_contact(uuid, uuid) is
  'Responder requests contact about a seeker pin; idempotent per (pin, responder); returns status enum.';

revoke all on function public.request_contact(uuid, uuid) from public;
grant execute on function public.request_contact(uuid, uuid) to authenticated;
grant execute on function public.request_contact(uuid, uuid) to service_role;
