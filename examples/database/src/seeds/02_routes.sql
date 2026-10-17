INSERT INTO routes (slug, origin, destination, nights) VALUES
  ('berlin-stockholm', 'BER', 'STO', 1),
  ('paris-vienna', 'PAR', 'VIE', 1),
  ('stockholm-berlin', 'STO', 'BER', 1)
ON CONFLICT (slug) DO NOTHING;
