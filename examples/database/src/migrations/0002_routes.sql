CREATE TABLE routes (
  id serial PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  origin text NOT NULL REFERENCES stations (code),
  destination text NOT NULL REFERENCES stations (code),
  nights int2 NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
