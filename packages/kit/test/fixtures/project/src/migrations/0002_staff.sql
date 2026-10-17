CREATE TABLE staff (
  id serial PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE leaders (
  event_id int NOT NULL REFERENCES events (id),
  staff_id int NOT NULL REFERENCES staff (id),
  PRIMARY KEY (event_id, staff_id)
);
