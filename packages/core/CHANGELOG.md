# @bezoar/core

## 0.0.5

### Patch Changes

- [`ca6d41a`](https://github.com/zoobzio/bezoar/commit/ca6d41a1af3b8b7a66f0cb91e69b522e0ddf10d5) Thanks [@zoobzio](https://github.com/zoobzio)! - Roles. A database package can hold `src/roles/<role>.sql`, the grants of a
  role, beside its migrations, seeds, and queries. The kit declares the roles
  before the migrations, applies the grants after them, checks every query
  under every role, and writes the queries each role may run into the
  contract as `roles`, with the grants as `roles.mjs`. The service takes a
  `role` and then offers the queries of the role alone, typed so, and `roles`
  applies the grants at runtime, with `roles.declare` for the roles alone. The
  `pg` and `pglite` executors take a `role` and run every statement as it.
  `makeTestBezoar` takes the grants and a role. The Nuxt module takes `role`
  and `roles`, scopes `useBezoar()` to the role, and provides
  `useBezoarOwner()` for the work of the plugin. A login user that joins a role
  stays the deployment's to make.
- Updated dependencies [[`ca6d41a`](https://github.com/zoobzio/bezoar/commit/ca6d41a1af3b8b7a66f0cb91e69b522e0ddf10d5)]:
  - @bezoar/schema@0.0.5

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

## 0.0.3

### Patch Changes

- Updated dependencies []:
  - @bezoar/schema@0.0.3

## 0.0.2

### Patch Changes

- Updated dependencies []:
  - @bezoar/schema@0.0.2

## 0.0.1

### Patch Changes

- [`7ddfccc`](https://github.com/zoobzio/bezoar/commit/7ddfccc1e0f12babb6817fc45ba41ff21e5b57d0) Thanks [@zoobzio](https://github.com/zoobzio)! - Initial release.

- Updated dependencies [[`7ddfccc`](https://github.com/zoobzio/bezoar/commit/7ddfccc1e0f12babb6817fc45ba41ff21e5b57d0)]:
  - @bezoar/schema@0.0.1
