-- Map viewport RPC: allow reads when the app uses the anon key (getSupabaseRead).
grant execute on function public.rents_in_bbox(
  double precision,
  double precision,
  double precision,
  double precision,
  timestamptz
) to anon, authenticated;
