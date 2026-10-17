import type { Executor } from "@bezoar/core";

import type { Columns } from "./types";

/**
 * Each column of each table, in declaration order, with whether it takes
 * null: the column has no `NOT NULL`, and its type is not a domain with one.
 * `visible` is whether the table resolves by its bare name.
 */
const COLUMNS = `
  SELECT n.nspname AS schema, c.relname AS table,
         pg_catalog.pg_table_is_visible(c.oid) AS visible,
         a.attname AS name, NOT (a.attnotnull OR t.typnotnull) AS nullable
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE c.relkind IN ('r', 'p')
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  ORDER BY n.nspname, c.relname, a.attnum`;

/**
 * Reads the columns of the tables of a database after the migrations ran,
 * for the nullability of the slots a query writes into them. A table is
 * keyed by `schema.name`, and by its bare name when the search path finds it.
 *
 * @param executor - The database to read.
 */
export const readColumns = async (executor: Executor): Promise<Columns> => {
  const columns = new Map<string, { name: string; nullable: boolean }[]>();
  for (const row of (await executor.query(COLUMNS, [])).rows) {
    const column = { name: String(row.name), nullable: row.nullable === true };
    const keys = [`${String(row.schema)}.${String(row.table)}`];
    if (row.visible === true) {
      keys.push(String(row.table));
    }
    for (const key of keys) {
      const list = columns.get(key);
      if (list === undefined) {
        columns.set(key, [column]);
      } else {
        list.push(column);
      }
    }
  }
  return columns;
};
