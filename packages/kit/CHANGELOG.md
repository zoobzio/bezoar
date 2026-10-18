# @bezoar/kit

## 0.0.4

### Patch Changes

- [#1](https://github.com/zoobzio/bezoar/pull/1) [`bcb3b57`](https://github.com/zoobzio/bezoar/commit/bcb3b5705bc19a1dff3b116a08090fc7f6241060) Thanks [@zoobzio](https://github.com/zoobzio)! - A query builder on the service. The contract carries the tables and the
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

- Updated dependencies [[`bcb3b57`](https://github.com/zoobzio/bezoar/commit/bcb3b5705bc19a1dff3b116a08090fc7f6241060)]:
  - @bezoar/schema@0.0.4
  - @bezoar/core@0.0.4
  - @bezoar/pglite@0.0.4

## 0.0.3

### Patch Changes

- [`307888d`](https://github.com/zoobzio/bezoar/commit/307888ddb98432b25a920292298e239b02afb1a9) Thanks [@zoobzio](https://github.com/zoobzio)! - A slot is nullable when its null has a meaning. The kit parses each query
  with libpg-query and marks a slot nullable when any use of it, through any
  cast, is the operand of `IS NULL` or `IS NOT NULL`, an argument of
  `COALESCE`, or a side of `IS DISTINCT FROM` or `IS NOT DISTINCT FROM`; or
  when an `INSERT`, an `UPDATE`, or an `ON CONFLICT DO UPDATE` writes it into
  a column that takes null, as the catalog of the hermetic database reports.
  A nullable slot is an optional argument that also takes `null`, as the
  schema and the runtime already define it. A slot used only in a comparison
  stays required.
- Updated dependencies []:
  - @bezoar/schema@0.0.3
  - @bezoar/core@0.0.3
  - @bezoar/pglite@0.0.3

## 0.0.2

### Patch Changes

- Updated dependencies []:
  - @bezoar/schema@0.0.2
  - @bezoar/core@0.0.2
  - @bezoar/pglite@0.0.2

## 0.0.1

### Patch Changes

- [`7ddfccc`](https://github.com/zoobzio/bezoar/commit/7ddfccc1e0f12babb6817fc45ba41ff21e5b57d0) Thanks [@zoobzio](https://github.com/zoobzio)! - Initial release.

- Updated dependencies [[`7ddfccc`](https://github.com/zoobzio/bezoar/commit/7ddfccc1e0f12babb6817fc45ba41ff21e5b57d0)]:
  - @bezoar/schema@0.0.1
  - @bezoar/core@0.0.1
  - @bezoar/pglite@0.0.1
