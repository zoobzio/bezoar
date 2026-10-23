-- The booking desk: reads the timetable, and makes and cancels bookings.
-- The sequence is what an insert into bookings draws its id from.
GRANT SELECT ON stations, routes, departures, bookings TO desk;
GRANT INSERT, DELETE ON bookings TO desk;
GRANT USAGE ON SEQUENCE bookings_id_seq TO desk;
