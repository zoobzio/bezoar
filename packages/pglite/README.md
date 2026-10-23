# @bezoar/pglite

A bezoar executor over [PGlite](https://pglite.dev), the Postgres that
runs in-process. `@bezoar/kit` builds on it. `@bezoar/testing` tests
on it. An app can develop on it with no server.

## Install

```sh
pnpm add @bezoar/pglite
```

The package carries PGlite.

## Usage

```ts
import { makeBezoar } from "@bezoar/core";
import { pglite } from "@bezoar/pglite";
import { contract } from "@bbf/database";
import { queries } from "@bbf/database/queries";
import { migrations } from "@bbf/database/migrations";

const executor = pglite();
const db = makeBezoar(contract, { executor, queries });

await db.migrate(migrations);
const events = await db.events.list({ day: "sunday" });

await executor.close();
```

`pglite()` makes a database in memory. `pglite("./data")` makes one on a
data directory. `pglite(options)` passes PGlite options through. The executor
exposes the instance as `client` and closes it with `close()`.

`pglite(client)` wraps a PGlite instance the caller made. The caller closes
it.

## Types

The rows of a query match the type table of `@bezoar/schema`. PGlite
parses most types the same way. The executor sets two parsers of its own:
`date` and `timestamp` stay strings in the form Postgres writes, where PGlite
would make a `Date` of them.

An `int8` in the safe integer range is a `number`. One outside the range is
a `bigint`, which the row validator of the service rejects.

## Array types

PGlite reads the array types of the database when it starts. A type that a
migration creates has an array type PGlite does not know until it reads them
again. The executor refreshes them after each `exec`, and after each
transaction that ran one, so a column such as `event_day[]` parses as an
array as soon as `migrate` returns.

## Roles

`pglite(source, { role })` makes an executor that runs every statement as
the role: each statement at the top level runs inside a transaction that
takes the role with `SET LOCAL ROLE`, and each transaction the executor
opens takes it first. The session of the client keeps its own role, so an
executor without one over the same client runs as the owner.

```ts
const owner = pglite();
const web = pglite(owner.client, { role: "web" });

await makeBezoar(contract, { executor: owner, queries }).migrate(migrations);
const db = makeBezoar(contract, { executor: web, queries, role: "web" });
```

The one in-process database serves both: the owner applies the migrations
and the grants, and the queries of the app run as the role, under its
grants and its policies, as they do in production. PGlite runs one
statement at a time, so a statement of the owner never lands inside a
transaction of the role.

## Transactions

`transaction` runs a function inside a transaction of the client. A
transaction inside a transaction is a savepoint: it is released when the
function returns and rolled back to when it throws, and the outer transaction
goes on.

## Related

- [`@bezoar/core`](../core): the service that runs on an executor.
- `@bezoar/pg`: the executor over node-postgres, for a database with a
  server.
