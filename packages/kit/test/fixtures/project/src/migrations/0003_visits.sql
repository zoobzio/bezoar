CREATE TABLE visits (
  id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id int NOT NULL REFERENCES events (id),
  ip inet NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE VIEW dated AS
SELECT id, slug, day
FROM events
WHERE day IS NOT NULL;
