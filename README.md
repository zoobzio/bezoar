# bezoar

bezoar is a type-safe database layer for Postgres. The source is SQL. The
build reads it and writes a typed client.

A database package holds migrations, seeds and queries, each as plain SQL. A
build kit applies the migrations to a hermetic Postgres, describes every
query, and writes modules with declarations. The runtime
service runs the queries by name, with the arguments and the rows typed by
what the SQL does. An app imports the build and has the database: it can
migrate, seed and query without the kit or the sources.

This repo is a scaffold. The packages are not here yet. They land one at a
time, in the order the workspace table lists them.

## Anatomy

A consumer writes a database package:

```
bezoar.config.ts
src/migrations/0001_events.sql
src/seeds/events.sql
src/queries/events/list.sql
src/queries/events/bySlug.sql
```

A query is one file of Postgres SQL, named for its path: the directory is
the group and the file is the name, so `events/list.sql` is `events.list`.
Nothing in the file declares a name or a kind. A slot is a named parameter
in the syntax of psql:

```sql
-- src/queries/events/list.sql
SELECT id, slug, title, day, start_time
FROM events
WHERE day = :day
ORDER BY start_time;
```

`bezoar build` boots [PGlite](https://pglite.dev) in memory, applies the
migrations and the seeds. For each query it rewrites
the slots to positions, asks Postgres to describe the statement, and walks
the parse tree with [libpg-query](https://github.com/pganalyze/libpg-query-node).
Postgres gives the type of each slot and each column. The tree gives what
Postgres does not: which table a column came from, and whether a slot or a
column can be null.

The build writes `.output/`:

- `index.mjs` and its declaration: the `Query` union, the `isQuery` guard, the
  `Arguments` and `Results` interfaces, and the `contract` a service is made
  from, with the tables and the views of the database. It carries no SQL.
- `queries.mjs`: the rewritten SQL of each query, by name.
- `migrations.mjs` and `seeds.mjs`: each file as data, with its version and a
  checksum, for the runner.

The runtime service takes the contract and an executor. The directory is
the group and the file is the name:

```ts
import { makeBezoar } from "bezoar";
import { pg } from "@bezoar/pg";
import { contract } from "@bbf/database";
import { queries } from "@bbf/database/queries";
import { migrations } from "@bbf/database/migrations";

const db = makeBezoar(contract, { executor: pg(pool) }, { queries });

await db.migrate(migrations);
const events = await db.events.list({ day: "sunday" });
const event = await db.events.bySlug.first({ slug: "worship" });
```

`day` completes to the labels of the enum. A wrong name fails to compile. The
rows are typed by the columns the query selects, and `first` takes the first
row or `null`. A transaction hands over a handle with the same surface.

The contract also carries the tables of the database, and the service
carries a [kysely](https://kysely.dev) typed by them, for the query a SQL
file cannot anticipate:

```ts
const sunday = await db
  .selectFrom("events")
  .select(["id", "slug"])
  .where("day", "=", "sunday")
  .execute();

const proven = await db.execute(
  query,
  z.object({ id: z.int(), slug: z.string() }),
);
```

A query built this way is typed by the tables and runs on the same executor
and in the same transaction as the named queries. `execute` proves its rows
against a schema the caller gives. A named query is always proven.

## Rules

The kit is a reader of SQL, not a dialect on top of it. Every lever is a SQL
lever:

- A cast sets the type of a slot. A slot Postgres cannot type fails the
  build and asks for one.
- A slot is required unless its null has a meaning: the SQL handles it, as
  the operand of `IS NULL`, an argument of `COALESCE`, or a side of
  `IS DISTINCT FROM`; or the statement writes it into a column that takes
  null. Such a slot is optional and takes `null`. A null anywhere else
  matches nothing in SQL, so the type does not allow one.
- An alias names a result column. Two columns with one name fail the build.
- `ANY(:ids)` takes an array. `RETURNING` types a write.
- A slot is a value, never an identifier. The SQL in the bundle is fixed at
  build time, and values travel as bound parameters.
- A query with a column returns its rows, and `first` beside it returns the
  first row or `null`. A query with no column returns the count of the rows
  the statement changed. The SQL decides, not an annotation.
- A `json` or `jsonb` column is `unknown`. The caller parses it.
- Migrations are forward only. A run is one transaction under an advisory
  lock. The runner checks the checksum of each applied migration and applies
  what the tracking table lacks.
- Seeds are untracked and run on demand. Write them to be idempotent.

One table in the schema package maps each Postgres type to the TypeScript type
the kit emits and the [zod](https://zod.dev) schema that checks it. The
schema package builds a zod validator for the arguments and the rows of every
query from the contract, so the service proves what comes in and what goes
out against the same source the types derive from. A driver parses the text
of Postgres to the types the table declares.

## Workspace

| Directory                        | Contents                                                    |
| -------------------------------- | ----------------------------------------------------------- |
| [`packages`](./packages)         | The library: the schema, the runtime service, the build kit |
| [`integrations`](./integrations) | Framework bridges                                           |
| [`examples`](./examples)         | Example apps                                                |

## Development

```sh
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

`pnpm build` runs through turbo, so a downstream package builds after the
packages it depends on. The tests of a package read its own build output, so
build before you test.

## License

MIT
