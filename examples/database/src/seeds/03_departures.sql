INSERT INTO departures (route_id, departs_at, seats, status, note)
SELECT r.id, d.departs_at, d.seats, d.status::departure_status, d.note
FROM (VALUES
  ('berlin-stockholm', '2026-11-20 18:30:00+01'::timestamptz, 120, 'scheduled', NULL),
  ('berlin-stockholm', '2026-11-27 18:30:00+01'::timestamptz, 120, 'scheduled', 'Bicycle carriage added'),
  ('paris-vienna', '2026-11-21 19:40:00+01'::timestamptz, 90, 'scheduled', NULL),
  ('stockholm-berlin', '2026-11-22 17:05:00+01'::timestamptz, 120, 'cancelled', 'Track works near Malmö')
) AS d (route, departs_at, seats, status, note)
JOIN routes r ON r.slug = d.route
ON CONFLICT (route_id, departs_at) DO NOTHING;
