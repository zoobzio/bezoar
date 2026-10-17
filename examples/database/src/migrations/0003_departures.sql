CREATE TYPE departure_status AS ENUM ('scheduled', 'boarding', 'departed', 'cancelled');

CREATE TABLE departures (
  id serial PRIMARY KEY,
  route_id int NOT NULL REFERENCES routes (id),
  departs_at timestamptz NOT NULL,
  seats int NOT NULL,
  status departure_status NOT NULL DEFAULT 'scheduled',
  note text,
  UNIQUE (route_id, departs_at)
);
