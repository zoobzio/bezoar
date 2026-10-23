# @bezoar/kit

The build kit of bezoar. The kit reads the SQL of a database package,
applies it to a Postgres in memory, and writes modules for the runtime.

## Install

```sh
pnpm add -D @bezoar/kit
```

## Config

Put `bezoar.config.ts` in the project root.

```ts
import { defineConfig } from "@bezoar/kit";

export default defineConfig({
  // Optional. The directory of migrations. Defaults to src/migrations.
  migrations: "src/migrations",

  // Optional. The directory of seeds. Defaults to src/seeds.
  seeds: "src/seeds",

  // Optional. The directory of queries. Defaults to src/queries.
  queries: "src/queries",

  // Optional. The directory of roles. Defaults to src/roles.
  roles: "src/roles",

  // Optional. The output directory. Defaults to bezoar.
  outDir: ".output",
});
```

Every path is relative to the project root and must stay inside it. The kit
checks the config before it reads a file, and reports every problem
together.

## Sources

A migration is a `.sql` file. The files apply in name order, so a name has
to sort: a counter or a timestamp first. The name of a file is its version,
which the runner records. A name of the form `<digits>_<rest>` also gives
the rest as the name for people. A migration is plain SQL and can hold many
statements.

```
src/migrations/0001_events.sql
src/migrations/0002_staff.sql
```

A seed is `<name>.sql`. The seeds run in name order. A seed is not tracked
by the runner, so write a seed that is safe to run again.

A role is `<role>.sql`, named for the role, so the name must be an
identifier. The file holds the grants of the role: what it may read and
write. The build makes each role before the migrations, as a role that
cannot log in, so a migration can name it in a policy, and runs each file
after the migrations, with every privilege of the role revoked first, so
the file states the whole of them. A role is not tracked, and runs again on
every run. Who logs in as the role is not the package's: the deployment
makes a login user that joins it.

```sql
-- src/roles/web.sql
GRANT SELECT ON events, sermons, staff TO web;
```

```sql
-- src/roles/admin.sql
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO admin;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO admin;
```

## Queries

A query is one `.sql` file, named for its path. Each directory is a group,
and the file name is the name: `events/list.sql` is `events.list`, and
`admin/staff/leaders.sql` is `admin.staff.leaders`. Each directory and the
file name must be an identifier. A file at the root of the directory is a
query with no group. A file beside a directory of the same name fails the
build, since the name would be both a query and a group.

```sql
-- src/queries/events/list.sql
SELECT id, slug, title, day
FROM events
WHERE day = :day
ORDER BY id;
```

```sql
-- src/queries/events/bySlug.sql
SELECT id, title FROM events WHERE slug = :slug;
```

A file holds one statement. A comment is fine anywhere. A file of comments
and blank lines alone fails the build. What a call returns follows from the
columns of the statement: a query with a column returns its rows, and the
service offers `first` beside it for the first row or `null`. A query with
no column, a write without `RETURNING`, returns the count of the rows the
statement changed. Nothing in the file declares this.

A slot is `:name`, the syntax of psql. The build rewrites each slot to a
position, so `:day` is `$1` in the SQL the service runs, and a name used
twice binds one position. A colon inside a string, a quoted identifier, a
dollar quote, or a comment is text, and `::` is a cast. A `$1` in the source
is an error: a query names its slots.

Every lever of a query is a SQL lever. A cast sets the type of a slot. An
alias names a column. Two columns with one name fail the build.

A slot is required unless its null has a meaning. The SQL gives it one when
the slot is the operand of `IS NULL` or `IS NOT NULL`, an argument of
`COALESCE`, or a side of `IS DISTINCT FROM` or `IS NOT DISTINCT FROM`,
through any cast. The schema gives it one when an `INSERT`, an `UPDATE`, or
an `ON CONFLICT DO UPDATE` writes the slot into a column without `NOT NULL`.
Such a slot is an optional argument that also takes `null`, and an absent
argument binds null. Any other slot is required: a null there matches
nothing.

```sql
-- src/queries/events/search.sql
SELECT id, slug, title
FROM events
WHERE (day = :day OR :day IS NULL)
  AND slug = COALESCE(:slug, slug)
ORDER BY id;
```

```sql
-- src/queries/events/insert.sql: day has no NOT NULL, so :day takes null.
INSERT INTO events (slug, title, day)
VALUES (:slug, :title, :day)
RETURNING id;
```

## Build

```sh
bezoar build
```

The build boots [PGlite](https://pglite.dev) in memory, declares the
roles, applies the migrations, applies the grants, and runs the seeds, in
that order. It reads the enums, and the tables and the views with their
columns. Then it serves the
database on a local port and describes each query through
[SafeQL](https://safeql.dev): Postgres reports the type of each slot and
each column, and SafeQL reports whether each column can be null, through
outer joins, `COALESCE`, aggregates, CTEs, and views. The kit parses each
query with [libpg-query](https://github.com/pganalyze/libpg-query-node) and
reads the columns of the catalog to decide whether each slot can be null.

After the queries are described, the build checks each one under each
role: inside a transaction that takes the role, it asks Postgres to plan
the query, with a null for each slot, and executes nothing. Planning checks
the privileges of the role on every table, column, and function of the
query, so a query the role lacks a privilege for is not the role's. A
policy of row-level security filters rows and fails no plan, so a query
under one is still the role's. The contract carries the result as `roles`:
the queries each role may run, by role. A query no role may run is not an
error; the owner runs it.

A file that Postgres rejects fails the build with the file and the error of
Postgres:

```
@bezoar/kit: src/migrations/0002_staff.sql failed: relation "evnts" does not exist
@bezoar/kit: src/queries/events/bySlug.sql failed: column "slgu" does not exist
@bezoar/kit: src/queries/events/list.sql the column ip has the type inet, which the type table does not have
```

The build writes to the output directory:

- `index.mjs` and its declaration: the `contract` and the `isQuery` guard.
  The declaration carries the contract as literal types, so `Arguments`,
  `Row`, `Returns`, and `Database` of `@bezoar/schema` derive from it.
  `Contract` and `Query` are its types. The module holds no SQL. The
  contract carries the tables and the views of the database with their
  columns, which type the query builder of the service. A table column of a
  type the type table does not have is `unknown`, and does not fail the
  build as a query column of one does. The contract carries the roles with
  the queries each may run, which scope the service of a role.
- `queries.mjs` and its declaration: the SQL of each query, by name, with
  the slots at their positions.
- `migrations.mjs` and its declaration: each migration as data, with its
  version, name, SQL, and checksum, for `migrate` of `@bezoar/core`.
- `seeds.mjs` and its declaration: each seed as data, for `seed`.
- `roles.mjs` and its declaration: each grant as data, with its role and
  its SQL, for `roles` of `@bezoar/core`.

The kit writes a manifest beside the files. A later build removes the files
the manifest lists that it no longer produces, and touches nothing else.

## API

- `defineConfig(config)` types a config file.
- `build(options?)` runs the whole build. `options.root` is the project
  root, and `options.config` the config file relative to it.
- `generate(config, root)` produces the output without writing it.

## Errors

- `MissingConfigError`: no file at the config path.
- `MalformedConfigError`: the config file does not default-export a record.
- `InvalidConfigError`: the config breaks a rule. Carries every issue.
- `InvalidSourceError`: Postgres rejected a migration, a grant, or a seed.
  Carries its path and the error of Postgres as `cause`.
- `InvalidRoleError`: a role file is not named for a role. Carries its
  path.
- `InvalidQueryError`: a query cannot be built. Carries the path of its
  file.

## Related

- [`@bezoar/core`](../core): the runtime that imports the build.
- [`@bezoar/schema`](../schema): the contract the build writes.
- [`@bezoar/pglite`](../pglite): the database the build runs in.
