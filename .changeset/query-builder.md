---
"@bezoar/schema": minor
"@bezoar/kit": minor
"@bezoar/core": minor
---

A query builder on the service. The contract carries the tables and the
views of the database: `tables` maps each one, by its bare name when the
search path finds it and by `schema.name` otherwise, to its kind and its
columns, each with its type, whether it takes null, and whether the
database can fill it. The kit reads them from the catalog of the hermetic
database after the migrations ran. A table column of a type the type table
does not have is `unknown`, and does not fail the build.

`Database<D>` of `@bezoar/schema` types the tables for
[kysely](https://kysely.dev), and the service of `@bezoar/core` carries a
query builder, `db.build`, a kysely over the executor of its container. A
query built on it, such as `db.build.selectFrom("events")`, runs on the
executor of the service, and on the executor of the transaction inside
`db.transaction`. `db.execute(query, validator?)` runs a built query
through the service, reports it through
`onQuery`, and with a validator, such as a zod schema, proves each row and
returns the output. `db.execute.first` takes the first row or `null`. The
report of `onQuery` gains the SQL of the query, and a built query reports
under the name `"build"`. The own `transaction` of the builder is refused in
favour of `db.transaction`.

`build` is reserved, so a top-level query group of that name is a
`ReservedQueryError`. `tables` is required on a definition: rebuild a
database package with this kit before the runtime of this release loads
its contract.
