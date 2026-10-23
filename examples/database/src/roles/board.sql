-- The departures board in the station hall: reads the timetable and the
-- seats left, and nothing about who booked them.
GRANT SELECT ON stations, routes, departures TO board;
GRANT SELECT (id, departure_id, seats) ON bookings TO board;
