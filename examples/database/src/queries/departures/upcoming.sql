-- The departures on each route, with the seats the bookings leave.

SELECT d.id, r.slug AS route, o.name AS origin, s.name AS destination,
       d.departs_at, d.status, d.seats,
       (d.seats - COALESCE(SUM(b.seats), 0))::int AS seats_left
FROM departures d
JOIN routes r ON r.id = d.route_id
JOIN stations o ON o.code = r.origin
JOIN stations s ON s.code = r.destination
LEFT JOIN bookings b ON b.departure_id = d.id
WHERE d.departs_at >= :after
GROUP BY d.id, r.slug, o.name, s.name
ORDER BY d.departs_at;
