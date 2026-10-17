CREATE TABLE bookings (
  id serial PRIMARY KEY,
  departure_id int NOT NULL REFERENCES departures (id),
  passenger text NOT NULL,
  email text NOT NULL,
  seats int NOT NULL CHECK (seats > 0),
  booked_at timestamptz NOT NULL DEFAULT now()
);
