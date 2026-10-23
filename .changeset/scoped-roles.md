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

Roles. A database package can hold `src/roles/<role>.sql`, the grants of a
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
