SELECT id, passenger, email, seats, booked_at
FROM bookings
WHERE departure_id = :departure
ORDER BY booked_at;
