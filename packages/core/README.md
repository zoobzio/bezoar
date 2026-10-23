# @bezoar/core

The runtime service of bezoar. The service runs the queries of a contract
by name, proves the arguments and the rows against the contract, builds
dynamic queries with [kysely](https://kysely.dev) over the tables of the
contract, and applies migrations and seeds.

[`@bezoar/schema`](../schema) has the contract types and the validation.
A driver package provides the connection.

## Install

```sh
pnpm add @bezoar/core
```

## Usage

`bezoar build` writes the contract to `.output/index.mjs` and the SQL to
`.output/queries.mjs`. `makeBezoar` makes the service from the contract
and a container with an executor and the SQL.

```ts
import { makeBezoar } from "@bezoar/core";
import { pglite } from "@bezoar/pglite";
import { contract } from "@bbf/database";
import { queries } from "@bbf/database/queries";

const db = makeBezoar(contract, { executor: pglite(client), queries });

const events = await db.events.list({ day: "sunday" });
const found = await db.events.bySlug.first({ slug: "worship-service" });
const inserted = await db.events.insert({ slug: "prayer", title: "Prayer" });
```

The directory of a query file is its group and the file is its name, so
`events/list.sql` is `db.events.list()`. `db.query("events.list", args)` is
the same call by name. The arguments complete to the slots of the query. A
required slot is required. A nullable slot is optional and takes `null`.

A query with a column returns its rows. A query with no column, a write
without `RETURNING`, returns the count of the rows the statement changed.
A query with a column also has `first`, which returns the first row or
`null` when there is none: `db.events.bySlug.first({ slug })`, or
`db.first("events.bySlug", { slug })` by name. A query with no column has
no `first`.

## The container

The container holds the executor and the SQL bundle. The service reads the
executor on each call, so a caller can replace it. The service never
connects. The caller brings an executor from a driver package.

```ts
interface Executor {
  query(sql: string, params: readonly unknown[]): Promise<Outcome>;
  exec(sql: string): Promise<void>;
  transaction<T>(run: (executor: Executor) => Promise<T>): Promise<T>;
}
```

`query` runs one statement with positional parameters. `exec` runs text
that can hold many statements and no parameters, which is how a migration
runs. `transaction` runs a function on one transaction and commits or rolls
back by whether the function returns or throws. The rows of an outcome are
objects by column name, with the values parsed to the types the schema table
declares.

## A call

A call proves its arguments against the slots of the query before anything
runs, and throws `InvalidArgumentsError` with every issue. The service binds
the arguments by slot position and runs the SQL of the bundle. A driver
failure is a `QueryError` that names the query and carries the driver's
error as `cause`. For `one` and `many`, each row is proven against the
columns, and a row that does not fit is an `InvalidRowError` with its index.

The `onQuery` option receives a report after each call: the query name, the
SQL, the arguments, the time in milliseconds, and the count of the outcome.

```ts
const db = makeBezoar(contract, config, {
  onQuery: ({ query, ms }) => console.log(`${query} ${ms.toFixed(1)}ms`),
});
```

## The query builder

A contract carries the tables and the views of the database, and the service
carries a query builder typed by them: `build`, a
[kysely](https://kysely.dev) over the executor of the service. A query built
on it runs on that executor when it executes.

```ts
const upcoming = await db.build
  .selectFrom("events")
  .select(["id", "slug", "title"])
  .where("day", "=", "sunday")
  .orderBy("start_time")
  .execute();

await db.build
  .insertInto("events")
  .values({ slug: "prayer", title: "Prayer" })
  .execute();
```

The tables type the builder. A column with a default or an identity is
optional in an insert. A column that takes null also takes `null`. A view is
read only. A column of a type the type table does not have is `unknown`.

A query that runs through the builder returns its rows as the builder infers
them, and no row is proven. `execute` runs a built query through the service
instead: it reports the query through `onQuery`, and with a validator it
proves each row and returns the output of the validator. Any zod schema is a
validator. A validator whose output does not fit the row the builder infers
fails to compile. `execute.first` takes the first row, or `null`.

```ts
const rows = await db.execute(
  db.build.selectFrom("events").select(["id", "slug"]),
  z.object({ id: z.int(), slug: z.string() }),
);
const one = await db.execute.first(query, schema);
```

A row that does not fit the validator is an `InvalidRowError`, and a driver
failure is a `QueryError`, each with the query name `"build"`. The report
of a built query carries the same name, the compiled SQL, and the parameters
as the arguments.

The own `transaction` of the builder is refused: a transaction belongs to
`transaction` of the service, and the service of a transaction has a builder
of its own.

## Transactions

`transaction` runs a function with a service over one transaction. The
service has the same queries, a builder over the transaction, and the same
options.

```ts
await db.transaction(async (tx) => {
  await tx.events.insert({ slug: "prayer", title: "Prayer Meeting" });
  await tx
    .updateTable("events")
    .set({ archived: true })
    .where("id", "in", [3, 4])
    .execute();
});
```

The transaction commits when the function returns and rolls back when it
throws. Whether a transaction inside a transaction opens a savepoint is up
to the driver.

## Roles

A contract built from a package with roles carries, for each role, the
queries the kit found it may run. A container with a `role` makes a service
over those queries alone, typed so: `db.admin.events.update` is not a member
of the service of `web`, and `db.query("admin.events.update")` is a type
error, and a `ForbiddenQueryError` by name at runtime. A role the contract
does not have is an `UnknownRoleError` at construction.

```ts
const web = makeBezoar(contract, {
  executor: pg(process.env.DATABASE_URL, { role: "web" }),
  queries,
  role: "web",
});
```

The service does not take the role itself: the executor does. Each driver
package takes a `role` and runs every statement as it. The database then
enforces what the role may do, under its grants and its policies, for the
queries of the contract and for the builder alike.

`roles` applies the grants of a build. The kit builds the list: each entry
has a role and its SQL.

```ts
import { roles } from "@bbf/database/roles";

await db.roles.declare(roles); // the roles alone, before the migrations
await db.migrate(migrations);
await db.roles(roles); // the grants, after the tables exist
await db.seed(seeds);
```

`roles.declare` makes each role the cluster lacks, as a role that cannot
log in, and grants nothing. A migration that names a role, in a policy or a
grant of its own, needs this first. `roles` makes the roles the cluster
lacks, and then for each role revokes every privilege it holds on the
tables, sequences, routines, and schemas of the database and runs its SQL,
inside one transaction under an advisory lock. A grant file states the
whole of the privileges of its role: a grant removed from the file is gone
after the next run. A membership of a role in another, and a default
privilege, are not revoked. A grant that fails is a `RoleError` with its
role, and the run rolls back.

The login users are the deployment's: a role of bezoar is a group, and a
user joins it with `CREATE ROLE bbf_web LOGIN PASSWORD '…' IN ROLE web`.
The package says what `web` may do and never who `web` is. A login user
that is a member of its role alone cannot migrate or grant, so an app over
one applies neither; the owner does.

## Migrations and seeds

`migrate` applies the migrations the database lacks. The kit builds the
list: each entry has a version, a name, its SQL, and a checksum.

```ts
import { migrations } from "@bbf/database/migrations";
import { seeds } from "@bbf/database/seeds";

const applied = await db.migrate(migrations); // the versions it applied
await db.seed(seeds);
```

The run is one transaction under an advisory lock. The lock makes two runs
wait for each other, so a rolling deploy applies each migration once. The
transaction makes the run all or nothing. The runner keeps each applied
version and its checksum in `bezoar_migrations`.

Before it applies anything, the runner compares the list with the database.
An applied version with another checksum, or an applied version that is not
in the list, is a `MigrationDriftError`: the database and the build
disagree, and the runner does not guess. A migration that fails is a
`MigrationError` with its version, and the run rolls back.

`seed` runs the seeds in order inside one transaction. Seeds are not
tracked. Write a seed so that it can run again. A seed that fails is a
`SeedError`, and the run rolls back.

## Names

The members of the service are `config`, `schema`, `query`, `first`,
`execute`, `build`, `transaction`, `migrate`, `seed`, and `roles`. A query
group cannot take one of these names,
and a name cannot be both a query and a group. Either is an error at
construction: `ReservedQueryError` or `AmbiguousQueryError`. `RESERVED`
exports the list.

## Errors

- `InvalidBundleError`: the SQL bundle does not match the contract.
- `InvalidArgumentsError`: the arguments of a call do not fit the slots.
- `InvalidRowError`: a row does not fit the columns, or the validator of a
  built query.
- `QueryError`: the driver failed. `cause` is the driver's error.
- `UnknownRoleError`: the container names a role the contract lacks.
- `ForbiddenQueryError`: a service scoped to a role was asked, by name, for
  a query the role may not run.
- `RoleError`: a grant failed to apply. `cause` is the driver's error.
- `MigrationDriftError`: the database holds a migration the list does not
  match.
- `MigrationError`, `SeedError`: a migration or a seed failed. `cause` is
  the driver's error.
- `ReservedQueryError`, `AmbiguousQueryError`: a query name the service
  cannot place.

## Types

- `Bezoar<D>` is the service: `Service<D>`, the `Builder<D>`, and the
  `Groups<D>`.
- `Config<D>` is the container. `Options<D>` has `onQuery`.
- `Executor` and `Outcome` are what a driver provides.
- `Method<D, Q>` is the function of one query. `Report<D>` is what `onQuery`
  receives.
- `Execute` is the signature of `execute`. `Validator<R>` is what it proves
  a row with. `Delegated` is the name of a builder member.
- `Migration` and `Seed` are what the kit builds for the runner.

## Related

- [`@bezoar/schema`](../schema): the contract types and the validation.
- `@bezoar/pglite`: an executor over PGlite.
