/**
 * The scalar types of the type table, by their Postgres names. Every slot and
 * every column has a scalar type, an enum type, or an array of one. The
 * `Scalar` union and the type table use this array.
 */
export const SCALARS = [
  "bool",
  "int2",
  "int4",
  "int8",
  "float4",
  "float8",
  "numeric",
  "text",
  "varchar",
  "bpchar",
  "uuid",
  "date",
  "time",
  "timetz",
  "timestamp",
  "timestamptz",
  "interval",
  "json",
  "jsonb",
  "bytea",
] as const;

/**
 * The suffix that marks an array type, as in `int4[]`. One suffix names every
 * array of a type. Postgres does not type the dimensions of an array.
 */
export const ARRAY = "[]";

/**
 * The type name of a table column whose type the type table does not have.
 * A query column of such a type fails a build. A table column of one is
 * `unknown`, so a table with one still builds.
 */
export const UNKNOWN = "unknown";

/**
 * The kinds of a table of a definition. A `view` is read and never written.
 */
export const TABLE_KINDS = ["table", "view"] as const;

/**
 * The members of a definition. `roles` is optional: a contract built before
 * roles existed has none.
 */
export const DEFINITION_KEYS = ["enums", "queries", "tables", "roles"] as const;

/**
 * The members of a table.
 */
export const TABLE_KEYS = ["kind", "columns"] as const;

/**
 * The members of a table column.
 */
export const TABLE_COLUMN_KEYS = [
  "name",
  "type",
  "nullable",
  "generated",
] as const;

/**
 * The members of a statement.
 */
export const STATEMENT_KEYS = ["slots", "columns"] as const;

/**
 * The members of a slot and of a column.
 */
export const FIELD_KEYS = ["name", "type", "nullable"] as const;

/**
 * Matches an identifier: a letter or an underscore, then letters, digits, and
 * underscores. An enum name is an identifier.
 */
export const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Matches a query name: identifiers joined by dots. The kit makes the name
 * from the path of the file, as in `events.list` for `events/list.sql`.
 */
export const QUERY = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/;
