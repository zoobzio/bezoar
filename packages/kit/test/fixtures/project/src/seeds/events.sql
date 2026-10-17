INSERT INTO events (slug, title, day)
VALUES ('worship', 'Worship', 'sunday')
ON CONFLICT (slug) DO NOTHING;
