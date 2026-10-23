# @bezoar/pg

A bezoar executor over [node-postgres](https://node-postgres.com), for a
Postgres with a server: a local one, Neon, Vercel Postgres, Supabase, RDS.

## Install

```sh
pnpm add @bezoar/pg
```

The package carries node-postgres.

## Usage

```ts
import { makeBezoar } from "bezoar";
import { pg } from "@bezoar/pg";
import { contract } from "@bbf/database";
import { queries } from "@bbf/database/queries";
import { migrations } from "@bbf/database/migrations";

const executor = pg(process.env.DATABASE_URL);
const db = makeBezoar(contract, { executor, queries });

await db.migrate(migrations);
const events = await db.events.list({ day: "sunday" });

await executor.close();
```

`pg(url)` makes a pool from a connection string. `pg(config)` makes one from
a pool config, such as `{ host, port, database, user, max }`. The executor
exposes the pool as `pool` and ends it with `close()`.

`pg(pool)` wraps a pool the caller made. A pool with the API of
node-postgres, such as the pool of `@neondatabase/serverless`, works the
same way. The caller ends it.

## Types

The rows of a query match the type table of `@bezoar/schema`. The
executor sets parsers of its own where node-postgres differs from the table:

- `int8` is a `number` in the safe integer range and a `bigint` outside it,
  which the row validator of the service rejects. node-postgres would keep
  the text.
- `date` and `timestamp` stay strings in the form Postgres writes, where
  node-postgres would make a `Date` of them.
- The arrays of the three parse element by element the same way.

Every other type parses as node-postgres parses it. `bytea` is a `Buffer`,
which is a `Uint8Array`.

## Array types

node-postgres has no parser for the array of an enum type, so the executor
reads the array types of enums from the database and parses each as an
array of text. It reads them again after each `exec`, so an enum a
migration creates parses as soon as `migrate` returns.

## Roles

`pg(source, { role })` makes an executor that runs every statement as the
role: each connection of the pool takes it with `SET ROLE` the first time
the executor uses the connection, and keeps it. The login user of the
connection string must be a member of the role, and a connection that
cannot take it is discarded, with the error of Postgres as the error of
the call.

```ts
const web = pg(process.env.DATABASE_URL, { role: "web" });
const db = makeBezoar(contract, { executor: web, queries, role: "web" });
```

The pool of a scoped executor is its own. An executor without a role over
the same pool would take a connection that has the role and run as it, so
the owner's work, migrations and grants, runs on a second executor over a
pool of its own: `pg(url)` beside `pg(url, { role })`.

## Transactions

`transaction` takes a client from the pool, runs the function on it inside
a transaction, and returns the client. A transaction inside a transaction is
a savepoint: it is released when the function returns and rolled back to
when it throws, and the outer transaction goes on.

## Related

- [`@bezoar/core`](../core): the service that runs on an executor.
- [`@bezoar/pglite`](../pglite): the executor over PGlite, for the build,
  for tests, and for a database in process.
