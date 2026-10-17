INSERT INTO bookings (departure_id, passenger, email, seats)
SELECT d.id, 'Ada Lovelace', 'ada@example.com', 2
FROM departures d
JOIN routes r ON r.id = d.route_id
WHERE r.slug = 'berlin-stockholm' AND d.departs_at = '2026-11-20 18:30:00+01'::timestamptz
  AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.departure_id = d.id AND b.email = 'ada@example.com');
