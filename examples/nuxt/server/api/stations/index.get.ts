/**
 * The stations, by name, with how many routes leave each. Built with the
 * query builder of the service rather than a query of the contract, as a
 * route the database package has no SQL file for.
 */
export default defineEventHandler(() => {
  const db = useBezoar();
  return db
    .selectFrom("stations")
    .leftJoin("routes", "routes.origin", "stations.code")
    .select((eb) => [
      "stations.code",
      "stations.name",
      "stations.country",
      eb.fn.count<number>("routes.id").as("departures"),
    ])
    .groupBy(["stations.code", "stations.name", "stations.country"])
    .orderBy("stations.name")
    .execute();
});
