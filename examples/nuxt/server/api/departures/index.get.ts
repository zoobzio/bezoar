/**
 * The departures from today on, each with the seats its bookings leave.
 */
export default defineEventHandler(() => {
  const db = useBezoar();
  return db.departures.upcoming({ after: new Date() });
});
