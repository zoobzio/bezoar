---
"@bezoar/kit": minor
---

A slot is nullable when the SQL handles its null. The kit parses each query
with libpg-query and marks a slot nullable when any use of it is the operand
of `IS NULL` or `IS NOT NULL`, an argument of `COALESCE`, or a side of
`IS DISTINCT FROM` or `IS NOT DISTINCT FROM`, through any cast. A nullable
slot is an optional argument that also takes `null`, as the schema and the
runtime already define it. A slot used only in a comparison stays required.
