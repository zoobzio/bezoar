# bezoar

The umbrella package for the bezoar runtime. The package re-exports
[`@bezoar/core`](../core) and [`@bezoar/schema`](../schema): the
service, the contract types, the validation, and the errors.

## Install

```sh
pnpm add bezoar
```

A driver is a separate package: [`@bezoar/pg`](../pg) for a Postgres
server, [`@bezoar/pglite`](../pglite) for a database in process.
[`@bezoar/kit`](../kit) builds the contract. Install the kit as a
development dependency.

## Usage

```ts
import { makeBezoar } from "bezoar";
import { pg } from "@bezoar/pg";
import { contract } from "@bbf/database";
import { queries } from "@bbf/database/queries";

const db = makeBezoar(contract, {
  executor: pg(process.env.DATABASE_URL),
  queries,
});

const events = await db.events.list({ day: "sunday" });
```

## Related

- [`@bezoar/core`](../core): the runtime service.
- [`@bezoar/schema`](../schema): the contract types and the validation.
