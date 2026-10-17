/**
 * Books seats on a departure. The body is proven against the arguments of
 * the query before anything runs.
 */
export default defineEventHandler(async (event) => {
  const db = useBezoar();
  const body = await readValidatedBody(
    event,
    db.schema.validators.queries["bookings.create"].arguments.parse,
  );
  return db.bookings.create.first(body);
});
