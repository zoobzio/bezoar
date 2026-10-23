# Nuxt example

The booking desk of Solstice Rail: a Nuxt app over the database of
`@bezoar/example-database`, through `@bezoar/nuxt`.

```sh
pnpm --filter @bezoar/example-database build
pnpm --filter @bezoar/example-nuxt dev
```

The module runs Postgres in the process with the `pglite` driver, declares
the roles, applies the migrations and the grants, and runs the seeds when
the server starts, so the example needs no database and no setup. The data
lives for the life of the server.

The app is the booking desk, so `role: "desk"` scopes `useBezoar()` to the
`desk` role of the database package: the service offers the queries the
desk may run, typed so, and runs them as the desk. The startup work runs as
the owner, on `useBezoarOwner()`.

- `server/api/departures/` lists the upcoming departures with the seats left,
  and one departure with its bookings.
- `server/api/bookings/` books seats and cancels a booking. The body of a
  booking is proven against the arguments of the query, through the zod
  schema the service exposes.
- `server/api/stations/` lists the stations with how many routes leave
  each, built with `db.build` of the service rather than a query of the
  database package.
- `app/pages/` shows the departures and lets a visitor book and cancel.

Each route handler calls `useBezoar()` and gets the service typed by the
contract of the build: `db.departures.upcoming({ after })` completes, and its
rows carry the types the SQL implies.
