# @bezoar/nuxt

Nuxt module for bezoar. The module takes a kit build and gives the server
a typed database service.

## Install

```sh
pnpm add @bezoar/nuxt
```

## Setup

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["@bezoar/nuxt"],
  bezoar: { build: "@acme/database", migrate: true },
});
```

`build` names a kit build: a package whose main entry is the `index.mjs`
that `bezoar build` wrote, or a path to that directory. The module adds
two virtual modules to the server build: `#bezoar/build`, which
re-exports the modules of the kit build, and `#bezoar/service`, the
service over its contract and its SQL. It writes a declaration of the
service into the build directory. `useBezoar()` and its types come from
the virtual service, so they are typed by the build. The modules are virtual
so that Nitro bundles them in dev as in production; the server plugin of
the module imports both.

## Connection

The module reads `runtimeConfig.bezoar`. An environment variable sets
each member.

| Member    | Variable               | Meaning                                     |
| --------- | ---------------------- | ------------------------------------------- |
| `url`     | `NUXT_BEZOAR_URL`      | The connection string, for the `pg` driver  |
| `dataDir` | `NUXT_BEZOAR_DATA_DIR` | The data directory, for the `pglite` driver |
| `driver`  | `NUXT_BEZOAR_DRIVER`   | `pg` or `pglite`. Defaults to `pg`          |
| `migrate` | `NUXT_BEZOAR_MIGRATE`  | Apply the migrations when the server starts |
| `seed`    | `NUXT_BEZOAR_SEED`     | Run the seeds when the server starts        |

`driver`, `migrate`, and `seed` can also be set in the module options. A
value in the runtime config wins.

The `pg` driver connects to a Postgres server and needs `url`. The `pglite`
driver runs Postgres in the process, on `dataDir`, or in memory when it is
empty. A server with the `pg` driver and no `url` fails to start.

## In a server route

```ts
export default defineEventHandler(async (event) => {
  const db = useBezoar();
  const { day } = await getValidatedQuery(
    event,
    db.schema.validators.queries["events.list"].arguments.parse,
  );
  return db.events.list({ day });
});
```

`useBezoar()` is auto-imported on the server. It returns the same service
on every call, typed by the contract of the build, so `db.events.list`
completes, and its arguments and rows check. The service carries the query
builder of `@bezoar/core`, `db.build`, a [kysely](https://kysely.dev)
typed by the tables of the build, so `db.build.selectFrom("events")`
completes as well.
`AppBezoar`, `AppBezoarContract`, `AppBezoarQuery`,
`AppBezoarArguments<Q>`, `AppBezoarRow<Q>`, and `AppBezoarDatabase` are the
types, also auto-imported.

## Startup and shutdown

A server plugin makes the service when the server starts. With `migrate`,
it applies the migrations of the build first, through `migrate` of
`@bezoar/core`, under an advisory lock, so instances that start together
apply each migration once. With `seed`, it runs the seeds after. When the
server stops, the plugin closes the connection. `closeBezoar()` closes it
by hand.

## Runtime

The `pg` driver needs a Node runtime, which the Node server presets of Nuxt
and the functions of Vercel are.

## Related

- [`bezoar`](../../packages/bezoar): the runtime.
- [`@bezoar/kit`](../../packages/kit): builds the contract the module
  adopts.
