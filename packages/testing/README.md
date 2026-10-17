# @bezoar/testing

A bezoar service over a database in memory, with the migrations applied
and the seeds run. What a test makes in place of a connection.

## Install

```sh
pnpm add -D @bezoar/testing
```

## Usage

```ts
import { makeTestBezoar } from "@bezoar/testing";
import { contract } from "@bbf/database";
import { queries } from "@bbf/database/queries";
import { migrations } from "@bbf/database/migrations";
import { seeds } from "@bbf/database/seeds";

const db = await makeTestBezoar(contract, { queries, migrations, seeds });

it("lists the Sunday events in time order", async () => {
  const events = await db.events.list({ day: "sunday" });
  expect(events.map((event) => event.slug)).toEqual(["worship-service"]);
});

afterAll(() => db.close());
```

Each call makes its own PGlite in memory, applies the migrations through
`migrate` of `@bezoar/core`, runs the seeds through `seed`, and returns the
service. The service has every query of the contract, as the one in the app
does. `seeds` is optional.

The service is async disposable, so a test can scope it:

```ts
await using db = await makeTestBezoar(contract, { queries, migrations });
```

The database closes when the block ends.

A third argument passes the options of the service through, such as
`onQuery`.

## Errors

A migration or a seed that fails throws `MigrationError` or `SeedError` from
`@bezoar/core`, after the database is closed.

## Related

- [`@bezoar/core`](../core): the service.
- [`@bezoar/pglite`](../pglite): the database the service runs on.
