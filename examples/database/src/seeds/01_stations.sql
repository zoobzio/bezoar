INSERT INTO stations (code, name, country, timezone) VALUES
  ('BER', 'Berlin Hauptbahnhof', 'DE', 'Europe/Berlin'),
  ('STO', 'Stockholm Central', 'SE', 'Europe/Stockholm'),
  ('PAR', 'Paris Gare de l''Est', 'FR', 'Europe/Paris'),
  ('VIE', 'Wien Hauptbahnhof', 'AT', 'Europe/Vienna')
ON CONFLICT (code) DO NOTHING;
