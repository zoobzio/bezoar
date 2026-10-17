# @bezoar/core

The runtime service of bezoar. The service runs the queries of a contract
by name, proves the arguments and the rows against the contract, and applies
migrations and seeds.

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
arguments, the time in milliseconds, and the count of the outcome.

```ts
const db = makeBezoar(contract, config, {
  onQuery: ({ query, ms }) => console.log(`${query} ${ms.toFixed(1)}ms`),
});
```

## Transactions

`transaction` runs a function with a service over one transaction. The
service has the same queries and options.

```ts
await db.transaction(async (tx) => {
  await tx.events.insert({ slug: "prayer", title: "Prayer Meeting" });
  await tx.events.archive({ ids: [3, 4] });
});
```

The transaction commits when the function returns and rolls back when it
throws. Whether a transaction inside a transaction opens a savepoint is up
to the driver.

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

The members of the service are `config`, `schema`, `query`, `transaction`,
`migrate`, and `seed`. A query group cannot take one of these names, and a
name cannot be both a query and a group. Either is an error at
construction: `ReservedQueryError` or `AmbiguousQueryError`.

## Errors

- `InvalidBundleError`: the SQL bundle does not match the contract.
- `InvalidArgumentsError`: the arguments of a call do not fit the slots.
- `InvalidRowError`: a row does not fit the columns.
- `QueryError`: the driver failed. `cause` is the driver's error.
- `MigrationDriftError`: the database holds a migration the list does not
  match.
- `MigrationError`, `SeedError`: a migration or a seed failed. `cause` is
  the driver's error.
- `ReservedQueryError`, `AmbiguousQueryError`: a query name the service
  cannot place.

## Types

- `Bezoar<D>` is the service: `Service<D>` and the `Groups<D>`.
- `Config<D>` is the container. `Options<D>` has `onQuery`.
- `Executor` and `Outcome` are what a driver provides.
- `Method<D, Q>` is the function of one query. `Report<D>` is what `onQuery`
  receives.
- `Migration` and `Seed` are what the kit builds for the runner.

## Related

- [`@bezoar/schema`](../schema): the contract types and the validation.
- `@bezoar/pglite`: an executor over PGlite.
