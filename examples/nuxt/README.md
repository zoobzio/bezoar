# Nuxt example

The booking desk of Solstice Rail: a Nuxt app over the database of
`@bezoar/example-database`, through `@bezoar/nuxt`.

```sh
pnpm --filter @bezoar/example-database build
pnpm --filter @bezoar/example-nuxt dev
```

The module runs Postgres in the process with the `pglite` driver, applies
the migrations and runs the seeds when the server starts, so the example
needs no database and no setup. The data lives for the life of the server.

- `server/api/departures/` lists the upcoming departures with the seats left,
  and one departure with its bookings.
- `server/api/bookings/` books seats and cancels a booking. The body of a
  booking is proven against the arguments of the query, through the zod
  schema the service exposes.
- `app/pages/` shows the departures and lets a visitor book and cancel.

Each route handler calls `useBezoar()` and gets the service typed by the
contract of the build: `db.departures.upcoming({ after })` completes, and its
rows carry the types the SQL implies.
