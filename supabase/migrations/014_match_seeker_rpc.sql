-- =============================================================================
-- STEP 3 — RPC: match_seeker(seeker_id uuid)
-- Finds rent_entries (via areas lat/lng) within seeker radius, filters by
-- budget band + BHK preference, scores (location / budget / preferences),
-- replaces pending property-only suggestions, returns JSON array of new rows.
-- Requires PostGIS + 009 domain model (areas.geom, rent_entries.area_id).
-- Run after 012 + 013.
--
-- PostgREST / supabase-js: .rpc('match_seeker', { seeker_id: '<uuid>' })
-- =============================================================================

create or replace function public.match_seeker(seeker_id uuid)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pin_id uuid := seeker_id;
  v_uid uuid;
  v_sp record;
  v_rows json;
  v_role text;
  v_is_service boolean;
begin
  v_uid := auth.uid();
  v_role := coalesce(auth.jwt() ->> 'role', '');
  v_is_service := v_role = 'service_role';

  select * into v_sp
  from public.seeker_pins sp
  where sp.id = pin_id;

  if not found then
    raise exception 'match_seeker: seeker pin not found';
  end if;

  -- End users: must own the pin. Service role: scheduled / server-side jobs.
  if v_is_service then
    null;
  elsif v_uid is null then
    raise exception 'match_seeker: authentication required';
  elsif v_sp.user_id is distinct from v_uid then
    raise exception 'match_seeker: not allowed';
  end if;

  -- Refresh only algorithm-generated property rows (keep accepted/rejected history).
  delete from public.matches m
  where m.seeker_id = pin_id
    and m.property_id is not null
    and m.matched_user_id is null
    and m.status = 'pending';

  with sp as (
    select
      s.id as seeker_id,
      s.lat as s_lat,
      s.lng as s_lng,
      s.radius_km,
      s.budget,
      s.bhk_preference
    from public.seeker_pins s
    where s.id = pin_id
  ),
  cand as (
    select
      re.id as property_id,
      re.rent,
      a.lat as p_lat,
      a.lng as p_lng,
      d.dist_km,
      case
        when sp.radius_km <= 0 then 0.0::double precision
        else greatest(
          0.0,
          least(
            1.0,
            1.0 - (d.dist_km / nullif(sp.radius_km::double precision * 1.5, 0))
          )
        )
      end as loc_score,
      greatest(
        0.0,
        least(
          1.0,
          1.0 - (
            abs(re.rent::double precision - sp.budget::double precision)
            / nullif(greatest(sp.budget::double precision * 0.35, 5000.0), 0)
          )
        )
      )::double precision as budget_score,
      1.0::double precision as bhk_component,
      case
        when pref.id is null then 0.72::double precision
        else 0.88::double precision
      end as pref_base
    from sp
    join public.rent_entries re on true
    join public.areas a on a.id = re.area_id
    left join public.seeker_preferences pref on pref.seeker_id = sp.seeker_id
    cross join lateral (
      select
        (
          st_distance(
            st_setsrid(st_makepoint(sp.s_lng, sp.s_lat), 4326)::geography,
            st_setsrid(st_makepoint(a.lng, a.lat), 4326)::geography
          ) / 1000.0
        )::double precision as dist_km
    ) d
    where
      st_dwithin(
        st_setsrid(st_makepoint(sp.s_lng, sp.s_lat), 4326)::geography,
        st_setsrid(st_makepoint(a.lng, a.lat), 4326)::geography,
        sp.radius_km::double precision * 1000.0
      )
      and re.rent <= sp.budget
      and re.rent >= greatest(3000, (sp.budget * 0.25)::integer)
      and (
        sp.bhk_preference is null
        or (
          (regexp_match(lower(trim(coalesce(re.bhk, ''))), '([0-9]+)'))[1] is not null
          and (regexp_match(lower(trim(coalesce(re.bhk, ''))), '([0-9]+)'))[1]::int
            = sp.bhk_preference
        )
      )
  ),
  scored as (
    select
      c.property_id,
      greatest(
        0.0,
        least(
          1.0,
          0.38 * c.loc_score
          + 0.37 * c.budget_score
          + 0.25 * least(1.0, c.pref_base * (0.85 + 0.15 * c.bhk_component))
        )
      )::double precision as match_score
    from cand c
  ),
  ranked as (
    select s.property_id, s.match_score
    from scored s
    order by s.match_score desc, s.property_id
    limit 400
  ),
  ins as (
    insert into public.matches (
      seeker_id,
      property_id,
      matched_user_id,
      match_score,
      status
    )
    select
      pin_id,
      r.property_id,
      null::uuid,
      r.match_score,
      'pending'::public.seeker_match_status
    from ranked r
    returning
      id,
      seeker_id,
      property_id,
      matched_user_id,
      match_score,
      status,
      created_at
  )
  select coalesce(
    json_agg(
      json_build_object(
        'id', i.id,
        'seeker_id', i.seeker_id,
        'property_id', i.property_id,
        'matched_user_id', i.matched_user_id,
        'match_score', i.match_score,
        'status', i.status,
        'created_at', i.created_at
      )
      order by i.match_score desc
    ),
    '[]'::json
  )
  into v_rows
  from ins i;

  return coalesce(v_rows, '[]'::json);
end;
$$;

comment on function public.match_seeker(uuid) is
  'Owner or service_role: radius match on areas, budget band, BHK; writes pending property matches (max 400); returns JSON.';

revoke all on function public.match_seeker(uuid) from public;
grant execute on function public.match_seeker(uuid) to authenticated;
grant execute on function public.match_seeker(uuid) to service_role;
