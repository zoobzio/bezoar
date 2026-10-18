# Database example

The database of Solstice Rail, a fictional night-train company, built with
`@bezoar/kit` into a package the Nuxt example imports. `bezoar build`
writes the contract, the SQL, the migrations, and the seeds under `.dist/`,
which is what this package exports. The Nuxt example's `bezoar.build`
option names it.

```sh
pnpm --filter @bezoar/example-database build
```

- `bezoar.config.ts` is the kit config: the output directory, and the
  defaults for the rest.
- `src/migrations/` holds four migrations: the stations, the routes between
  them, the departures on each route with their status enum, and the
  bookings on each departure.
- `src/seeds/` holds the stations, routes, departures, and one booking of a
  small timetable. Each seed is safe to run again.
- `src/queries/` holds one file per query, under a directory per group.
  `departures/upcoming.sql` is `db.departures.upcoming({ after })`, and
  lists each departure with the seats its bookings leave.
  `db.departures.byId.first({ id })` takes the one row of a lookup.

`pnpm typecheck` proves the types a consumer derives from the build, in
`test/types.ts`, among them the `Database` the query builder is typed by.
`pnpm test` builds a service over the package with `@bezoar/testing`, runs
every query, and builds a few queries the package has no SQL file for with
the builder of the service.
