INSERT INTO bookings (departure_id, passenger, email, seats)
VALUES (:departure, :passenger, :email, :seats)
RETURNING id, booked_at;
