-- The events of a day, in order.

SELECT id, slug, title, day, weeks, created_at
FROM events
WHERE day = :day
ORDER BY id;
