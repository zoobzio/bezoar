SELECT e.id, e.title, s.name AS leader
FROM events e
LEFT JOIN leaders l ON l.event_id = e.id
LEFT JOIN staff s ON s.id = l.staff_id
ORDER BY e.id;
