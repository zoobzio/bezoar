# Packages

The packages land one at a time, in this order, so each can be reviewed on
its own. A package without a link is not here yet.

| Package                        | Directory          | Description                                                    |
| ------------------------------ | ------------------ | -------------------------------------------------------------- |
| [`@bezoar/schema`](./schema)   | `packages/schema`  | The contract: the query model, the type table, zod validators  |
| [`@bezoar/core`](./core)       | `packages/core`    | The runtime service: run queries by name, migrate, seed        |
| [`@bezoar/kit`](./kit)         | `packages/kit`     | Build kit: SQL in a hermetic Postgres to typed modules         |
| [`@bezoar/pglite`](./pglite)   | `packages/pglite`  | Executor over PGlite, for the kit and for tests                |
| [`@bezoar/pg`](./pg)           | `packages/pg`      | Executor over node-postgres                                    |
| [`@bezoar/testing`](./testing) | `packages/testing` | A service over PGlite with the migrations and seeds of a build |
| [`bezoar`](./bezoar)           | `packages/bezoar`  | Umbrella package for the runtime                               |

The kit is a build-time tool and is not re-exported by `bezoar`. Framework
integrations live in [`../integrations`](../integrations).
