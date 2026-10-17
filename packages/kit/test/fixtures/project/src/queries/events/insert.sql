INSERT INTO events (slug, title, day)
VALUES (:slug, :title, :day)
RETURNING id, created_at;
