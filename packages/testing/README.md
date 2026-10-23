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

## Roles

`roles` takes the grants of the build. The roles are declared before the
migrations, so a migration can name one in a policy, and the grants are
applied after them, before the seeds, through `roles` of `@bezoar/core`.
`role` scopes the service to one of them: the service offers the queries of
the role and runs them as the role, as the app does, while the migrations,
the grants, and the seeds ran as the owner.

```ts
import { roles } from "@bbf/database/roles";

const db = await makeTestBezoar(contract, {
  queries,
  migrations,
  seeds,
  roles,
  role: "web",
});

await db.web.events.list(); // runs as web, under its policies
db.admin; // a type error: not a query of web
```

## Errors

A migration, a grant, or a seed that fails throws `MigrationError`,
`RoleError`, or `SeedError` from `@bezoar/core`, after the database is
closed. A role the contract does not have throws `UnknownRoleError`.

## Related

- [`@bezoar/core`](../core): the service.
- [`@bezoar/pglite`](../pglite): the database the service runs on.
