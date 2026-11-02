# @bezoar/pg

## 0.0.6

### Patch Changes

- [`c882d15`](https://github.com/zoobzio/bezoar/commit/c882d154b99b5d6a2e20e19d19523866519d0661) Thanks [@zoobzio](https://github.com/zoobzio)! - Database. The kit config and `makeTestBezoar` take `database`: PGlite
  options, or a function that makes the client. A migration that creates an
  extension, such as `pg_trgm` for a trigram index, loads it there with
  `{ extensions: { pg_trgm } }` from `@electric-sql/pglite/contrib/pg_trgm`,
  so the build and the tests run on a database that has it. The default stays
  a database in memory with no extensions.
- Updated dependencies [[`c882d15`](https://github.com/zoobzio/bezoar/commit/c882d154b99b5d6a2e20e19d19523866519d0661)]:
  - @bezoar/core@0.0.6

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
  - @bezoar/core@0.0.5

## 0.0.4

### Patch Changes

- Updated dependencies [[`bcb3b57`](https://github.com/zoobzio/bezoar/commit/bcb3b5705bc19a1dff3b116a08090fc7f6241060)]:
  - @bezoar/core@0.0.4

## 0.0.3

### Patch Changes

- Updated dependencies []:
  - @bezoar/core@0.0.3

## 0.0.2

### Patch Changes

- Updated dependencies []:
  - @bezoar/core@0.0.2

## 0.0.1

### Patch Changes

- [`7ddfccc`](https://github.com/zoobzio/bezoar/commit/7ddfccc1e0f12babb6817fc45ba41ff21e5b57d0) Thanks [@zoobzio](https://github.com/zoobzio)! - Initial release.

- Updated dependencies [[`7ddfccc`](https://github.com/zoobzio/bezoar/commit/7ddfccc1e0f12babb6817fc45ba41ff21e5b57d0)]:
  - @bezoar/core@0.0.1
