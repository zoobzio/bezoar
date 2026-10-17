# @bezoar/kit

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
