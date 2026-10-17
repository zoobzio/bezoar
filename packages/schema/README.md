# @bezoar/schema

Types and runtime validation for the bezoar contract. The validation uses
[zod](https://zod.dev) schemas built from the contract.

## Install

```sh
pnpm add @bezoar/schema
```

## The contract

A **definition** declares the contract. `@bezoar/kit` builds one from the
SQL of a database package. The definition is plain data and holds no SQL.

- **enums** maps each enum type of the database to its labels, in
  declaration order.
- **queries** maps each query name, such as `events.list`, to its
  **statement**.
- A statement has its **slots** and its **columns**. A statement with no
  column returns no rows: a write without `RETURNING`.
- A **slot** is a named parameter of the SQL. A **column** is a field of each
  row. Each has a `name`, a `type`, and a `nullable` flag. The slots are in
  position order: the slot at index `i` binds `$i+1`.
- A **type** is a scalar of the type table, an enum of the definition, or
  either with the `[]` suffix.

```ts
const contract = {
  enums: { event_day: ["sunday", "monday" /* … */] },
  queries: {
    "events.list": {
      slots: [
        { name: "day", type: "event_day", nullable: false },
        { name: "location", type: "text", nullable: true },
      ],
      columns: [
        { name: "id", type: "int4", nullable: false },
        { name: "title", type: "text", nullable: false },
        { name: "weeks", type: "int4[]", nullable: true },
      ],
    },
  },
} as const satisfies Definition;
```

The types of the arguments and the rows derive from the definition. A
required slot is a required member. A nullable slot is optional and also
takes `null`. A nullable column also holds `null`.

```ts
type D = typeof contract;

Arguments<D, "events.list">; // { day: "sunday" | "monday" | …; location?: string | null }
Row<D, "events.list">; // { id: number; title: string; weeks: (number | null)[] | null }
Returns<D, "events.list">; // Row<D, "events.list">[]
Returns<D, "events.touch">; // number, for a query with no column
```

## The type table

One table maps each Postgres type to its JavaScript form. `Scalars` declares
the type the kit emits. `TABLE` holds the zod schema for each, and the
compiler holds the two to each other.

| Postgres                          | JavaScript   | Schema                                       |
| --------------------------------- | ------------ | -------------------------------------------- |
| `bool`                            | `boolean`    | `z.boolean()`                                |
| `int2`, `int4`, `int8`            | `number`     | `z.int()`, so an unsafe `int8` fails         |
| `float4`, `float8`                | `number`     | Any number, so `NaN` and the infinities pass |
| `numeric`                         | `string`     | `z.string()`, so no digit is lost            |
| `text`, `varchar`, `bpchar`       | `string`     | `z.string()`                                 |
| `uuid`                            | `string`     | `z.uuid()`                                   |
| `date`, `time`                    | `string`     | `z.iso.date()`, `z.iso.time()`               |
| `timetz`, `timestamp`, `interval` | `string`     | `z.string()`, as Postgres writes them        |
| `timestamptz`                     | `Date`       | `z.date()`                                   |
| `json`, `jsonb`                   | `unknown`    | `z.json()`, a JSON value                     |
| `bytea`                           | `Uint8Array` | `z.instanceof(Uint8Array)`                   |

An enum is `z.enum` over its labels. An array is `z.array` of its element,
with a null element allowed, since Postgres allows one. Postgres does not
type the dimensions of an array, so the schema of an array is
one-dimensional.

A driver parses the text of Postgres to these types. A time without a zone
has no instant, so the temporal types other than `timestamptz` stay strings.

## defineSchema

`defineSchema(definition)` returns a `Schema<D>`. The schema validates
untrusted data against the vocabulary of the definition. Data that passes is
bound to the contract.

```ts
import { defineSchema } from "@bezoar/schema";

const schema = defineSchema(contract);

// Returns a boolean. The type of the value narrows on `true`.
if (!schema.check.query(name)) throw new Error("not a query");

// Throws a SchemaError that lists every issue.
schema.assert.arguments("events.list", await readBody(event));

// Throws on an invalid value. Returns the value with its narrowed type.
const row = schema.parse.row("events.list", candidate);

// Returns { success: true, data } or { success: false, issues }.
const result = schema.inspect.definition(candidate);
```

The function checks the definition before it reads it. An invalid definition
throws when you call `defineSchema`.

The `Schema<D>` has these members:

- `base` is the definition.
- `validators` holds the zod schemas: `definition`, `query`, `bundle`, and
  for each query under `queries` its `arguments` and its `row`. Use them where a zod
  schema is wanted, such as a route handler. `z.infer` of a schema is the
  type the service uses.
- `check` has one boolean predicate for each kind.
- `assert` has one assertion for each kind. A failed assertion throws a
  `SchemaError` that holds every `Issue`.
- `parse` asserts a value and returns it with the type of its kind.
- `inspect` returns a `Result` for each kind.

## Kinds

Each member of `check`, `assert`, `parse`, and `inspect` validates one
**kind**. A kind of a query takes the query name first.

- `definition` is a complete definition.
- `query` is a query name of the contract.
- `bundle` is the SQL bundle: the text of every query of the contract, by
  name, and no other.
- `arguments(query, value)` is an object with a member for each slot of the
  query. A required slot must be present and not `null`. A nullable slot can
  be absent, `null`, or a value. A key the query does not name is an issue.
- `row(query, value)` is an object with a member for each column of the
  query and no other. A nullable column holds a value or `null`.

```ts
schema.assert.arguments("events.list", { day: "sunday" }); // passes
schema.assert.arguments("events.list", { day: "someday" }); // SchemaError: day: Invalid option …
schema.check.row("events.list", await res.json()); // true when the row fits the columns
```

## Types

- `Definition` is the contract. `Statement`, `Slot`, and `Column` are its
  parts.
- `Query<D>`, `Enum<D>`, and `Label<D, E>` are names from a definition.
  `RowQuery<D>` is the name of a query with a column. `Type<D>` is a type
  name the definition can express.
- `Scalars` maps each scalar to its JavaScript type. `Scalar` is the union of
  its keys. `Value<D, T>` is the JavaScript type for a type name.
- `Arguments<D, Q>`, `Row<D, Q>`, and `Returns<D, Q>` are the shapes of a
  call of the query `Q`. `Returns` is the rows of a query with a column and
  the count of one without.
- `Bundle<D>` is the SQL bundle of a contract.
- `Validators<D>` is the shape of the zod schemas.
- `Schema<D>` is the bundle that `defineSchema` returns. `Check<D>`,
  `Assert<D>`, `Parse<D>`, and `Inspect<D>` are its families of functions.
- `Result<V>` is the outcome of `inspect`.
- `Issue` is a validation failure, as zod reports it.
- `SchemaError` is the error that `assert` and `parse` throw. It holds the
  `Issue` list.

## Related

- `@bezoar/core` is the runtime service that uses this schema.
- `@bezoar/kit` builds a definition from SQL.
