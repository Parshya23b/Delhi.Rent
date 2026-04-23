-- Starter pins (requires migration 009 — areas + slim rent_entries + rent_sources).
-- Idempotent fixed UUIDs.

insert into public.areas (id, label, lat, lng) values
  ('b0000001-0000-4000-8000-000000000001', 'Connaught Place', 28.6139, 77.209),
  ('b0000001-0000-4000-8000-000000000002', 'Saket', 28.5272, 77.2166),
  ('b0000001-0000-4000-8000-000000000003', 'Noida Sector 62', 28.5355, 77.391),
  ('b0000001-0000-4000-8000-000000000004', 'Gurgaon Cyber City', 28.4089, 77.0378),
  ('b0000001-0000-4000-8000-000000000005', 'Rohini', 28.6517, 77.2219)
on conflict (id) do nothing;

insert into public.rent_entries (id, area_id, rent, bhk, furnishing) values
  ('a0000001-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000001', 52000, '2BHK', 'Semi-furnished'),
  ('a0000001-0000-4000-8000-000000000002', 'b0000001-0000-4000-8000-000000000002', 45000, '2BHK', 'Fully furnished'),
  ('a0000001-0000-4000-8000-000000000003', 'b0000001-0000-4000-8000-000000000003', 28000, '1BHK', 'Unfurnished'),
  ('a0000001-0000-4000-8000-000000000004', 'b0000001-0000-4000-8000-000000000004', 62000, '3BHK', 'Fully furnished'),
  ('a0000001-0000-4000-8000-000000000005', 'b0000001-0000-4000-8000-000000000005', 19000, '1RK', 'Semi-furnished')
on conflict (id) do nothing;

insert into public.rent_sources (id, rent_entry_id, source_type, confidence_score, verified) values
  ('c0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000001', 'owner', 55, false),
  ('c0000001-0000-4000-8000-000000000002', 'a0000001-0000-4000-8000-000000000002', 'broker', 50, false),
  ('c0000001-0000-4000-8000-000000000003', 'a0000001-0000-4000-8000-000000000003', 'owner', 35, false),
  ('c0000001-0000-4000-8000-000000000004', 'a0000001-0000-4000-8000-000000000004', 'broker', 90, true),
  ('c0000001-0000-4000-8000-000000000005', 'a0000001-0000-4000-8000-000000000005', 'owner', 55, false)
on conflict (id) do nothing;

insert into public.verification_logs (rent_entry_id, action, user_id)
select v.rent_entry_id, v.action, v.user_id
from (
  values
    ('a0000001-0000-4000-8000-000000000001'::uuid, 'confirmed'::text, 'seed-device-1'::text),
    ('a0000001-0000-4000-8000-000000000004'::uuid, 'confirmed', 'seed-device-2'),
    ('a0000001-0000-4000-8000-000000000004'::uuid, 'confirmed', 'seed-device-3'),
    ('a0000001-0000-4000-8000-000000000004'::uuid, 'confirmed', 'seed-device-4'),
    ('a0000001-0000-4000-8000-000000000004'::uuid, 'confirmed', 'seed-device-5'),
    ('a0000001-0000-4000-8000-000000000005'::uuid, 'confirmed', 'seed-device-a'),
    ('a0000001-0000-4000-8000-000000000005'::uuid, 'confirmed', 'seed-device-b')
) as v(rent_entry_id, action, user_id)
where not exists (
  select 1
  from public.verification_logs vl
  where vl.rent_entry_id = v.rent_entry_id
    and vl.user_id = v.user_id
    and vl.action = v.action
);
