/**
 * One departure with its bookings, or 404.
 */
export default defineEventHandler(async (event) => {
  const db = useBezoar();
  const id = Number(getRouterParam(event, "id"));
  const departure = await db.departures.byId.first({ id });
  if (departure === null) {
    throw createError({ statusCode: 404, statusMessage: "No such departure" });
  }
  const bookings = await db.bookings.forDeparture({ departure: id });
  return { departure, bookings };
});
