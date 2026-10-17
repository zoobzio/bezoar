---
"@bezoar/kit": minor
---

A slot is nullable when its null has a meaning. The kit parses each query
with libpg-query and marks a slot nullable when any use of it, through any
cast, is the operand of `IS NULL` or `IS NOT NULL`, an argument of
`COALESCE`, or a side of `IS DISTINCT FROM` or `IS NOT DISTINCT FROM`; or
when an `INSERT`, an `UPDATE`, or an `ON CONFLICT DO UPDATE` writes it into
a column that takes null, as the catalog of the hermetic database reports.
A nullable slot is an optional argument that also takes `null`, as the
schema and the runtime already define it. A slot used only in a comparison
stays required.
