SELECT r.id, r.slug, r.nights, o.name AS origin, d.name AS destination
FROM routes r
JOIN stations o ON o.code = r.origin
JOIN stations d ON d.code = r.destination
ORDER BY o.name, d.name;
