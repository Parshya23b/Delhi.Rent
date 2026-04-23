-- =============================================================================
-- STEP 8 (contact) + integration — Verified email for contact; RPC for respond
-- Prefer SQL over ad-hoc updates from the app.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- request_contact: require confirmed email on JWT (skip for service_role)
-- ---------------------------------------------------------------------------
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
  v_confirmed text;
begin
  v_uid := auth.uid();
  v_role := coalesce(auth.jwt() ->> 'role', '');
  v_is_service := v_role = 'service_role';
  v_confirmed := auth.jwt() ->> 'email_confirmed_at';

  if not v_is_service then
    if v_uid is null then
      raise exception 'request_contact: authentication required';
    end if;
    if r_id is distinct from v_uid then
      raise exception 'request_contact: responder_id must match the signed-in user';
    end if;
    if v_confirmed is null or length(trim(v_confirmed)) = 0 then
      raise exception 'request_contact: verified email required before contacting seekers';
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
  'Responder → seeker pin; requires email_confirmed_at on JWT; idempotent per (pin, responder).';

-- ---------------------------------------------------------------------------
-- respond_contact — approve / reject (verified email, responder-only)
-- ---------------------------------------------------------------------------
create or replace function public.respond_contact(request_id uuid, decision text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
  v_role text;
  v_is_service boolean;
  v_confirmed text;
  v_next public.seeker_contact_request_status;
  v_row public.contact_requests%rowtype;
  v_n integer;
begin
  v_uid := auth.uid();
  v_role := coalesce(auth.jwt() ->> 'role', '');
  v_is_service := v_role = 'service_role';
  v_confirmed := auth.jwt() ->> 'email_confirmed_at';

  if decision not in ('approve', 'reject') then
    raise exception 'respond_contact: decision must be approve or reject';
  end if;

  v_next := case decision
    when 'approve' then 'approved'::public.seeker_contact_request_status
    else 'rejected'::public.seeker_contact_request_status
  end;

  if not v_is_service then
    if v_uid is null then
      raise exception 'respond_contact: authentication required';
    end if;
    if v_confirmed is null or length(trim(v_confirmed)) = 0 then
      raise exception 'respond_contact: verified email required';
    end if;
  end if;

  update public.contact_requests cr
  set status = v_next
  where cr.id = request_id
    and (v_is_service or cr.responder_id = v_uid);

  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'respond_contact: not found or not allowed';
  end if;

  select * into strict v_row
  from public.contact_requests cr
  where cr.id = request_id;

  return row_to_json(v_row)::json;
end;
$$;

comment on function public.respond_contact(uuid, text) is
  'Responder approves/rejects a contact request; requires verified email (JWT).';

revoke all on function public.respond_contact(uuid, text) from public;
grant execute on function public.respond_contact(uuid, text) to authenticated;
grant execute on function public.respond_contact(uuid, text) to service_role;
