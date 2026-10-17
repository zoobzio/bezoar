SELECT d.id, r.slug AS route, o.name AS origin, s.name AS destination,
       d.departs_at, d.status, d.seats, d.note
FROM departures d
JOIN routes r ON r.id = d.route_id
JOIN stations o ON o.code = r.origin
JOIN stations s ON s.code = r.destination
WHERE d.id = :id;
