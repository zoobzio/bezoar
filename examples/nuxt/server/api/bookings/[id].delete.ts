/**
 * Cancels a booking. Answers with the count of bookings removed.
 */
export default defineEventHandler(async (event) => {
  const db = useBezoar();
  const id = Number(getRouterParam(event, "id"));
  return { cancelled: await db.bookings.cancel({ id }) };
});
