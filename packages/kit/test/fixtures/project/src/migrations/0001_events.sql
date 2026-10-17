CREATE TYPE event_day AS ENUM ('sunday', 'monday', 'tuesday');

CREATE TABLE events (
  id serial PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  day event_day,
  weeks int4[],
  created_at timestamptz NOT NULL DEFAULT now()
);
