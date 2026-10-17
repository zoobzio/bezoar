-- The events of a day, or of every day when no day is given, with a slug
-- to narrow them further. The cast types the slot: IS NULL alone cannot.

SELECT id, slug, title, day
FROM events
WHERE (:day::event_day IS NULL OR day = :day)
  AND slug = COALESCE(:slug, slug)
ORDER BY id;
