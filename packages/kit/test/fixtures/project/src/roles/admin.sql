-- The office: reads and writes everything, and uses the sequences the
-- identity columns draw from.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO admin;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO admin;
