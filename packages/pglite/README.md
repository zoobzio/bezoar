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

## Transactions

`transaction` runs a function inside a transaction of the client. A
transaction inside a transaction is a savepoint: it is released when the
function returns and rolled back to when it throws, and the outer transaction
goes on.

## Related

- [`@bezoar/core`](../core): the service that runs on an executor.
- `@bezoar/pg`: the executor over node-postgres, for a database with a
  server.
