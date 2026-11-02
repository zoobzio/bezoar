---
"bezoar": patch
"@bezoar/schema": patch
"@bezoar/core": patch
"@bezoar/pglite": patch
"@bezoar/pg": patch
"@bezoar/testing": patch
"@bezoar/kit": patch
"@bezoar/nuxt": patch
---

Database. The kit config and `makeTestBezoar` take `database`: PGlite
options, or a function that makes the client. A migration that creates an
extension, such as `pg_trgm` for a trigram index, loads it there with
`{ extensions: { pg_trgm } }` from `@electric-sql/pglite/contrib/pg_trgm`,
so the build and the tests run on a database that has it. The default stays
a database in memory with no extensions.
