import type { Executor } from "@bezoar/core";

import type { Columns, Relation } from "./types";

/**
 * Each column of each table and view, in declaration order: its type OID,
 * whether it takes null, and whether the database can fill it. A column
 * takes null when it has no `NOT NULL` and its type is not a domain with
 * one. The database fills a column that has a default, an identity, or a
 * generation expression. `visible` is whether the relation resolves by its
 * bare name.
 */
const RELATIONS = `
  SELECT n.nspname AS schema, c.relname AS name, c.relkind::text AS kind,
         pg_catalog.pg_table_is_visible(c.oid) AS visible,
         a.attname AS column, a.atttypid::int AS type,
         NOT (a.attnotnull OR t.typnotnull) AS nullable,
         (a.atthasdef OR a.attidentity <> '' OR a.attgenerated <> '') AS generated
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE c.relkind IN ('r', 'p', 'v', 'm')
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  ORDER BY n.nspname, c.relname, a.attnum`;

/**
 * The kind of a relation from its `relkind`: a table or a partitioned table
 * is a table, and a view or a materialized view is a view.
 */
const kindOf = (relkind: unknown): Relation["kind"] =>
  relkind === "v" || relkind === "m" ? "view" : "table";

/**
 * Reads the tables and the views of a database after the migrations ran,
 * with their columns, for the tables of the contract and for the
 * nullability of the slots a query writes into them.
 *
 * @param executor - The database to read.
 */
export const readRelations = async (
  executor: Executor,
): Promise<Relation[]> => {
  const relations: Relation[] = [];
  let current: Relation | undefined;
  for (const row of (await executor.query(RELATIONS, [])).rows) {
    const schema = String(row.schema);
    const name = String(row.name);
    if (current?.schema !== schema || current.name !== name) {
      current = {
        schema,
        name,
        kind: kindOf(row.kind),
        visible: row.visible === true,
        columns: [],
      };
      relations.push(current);
    }
    current.columns.push({
      name: String(row.column),
      type: Number(row.type),
      nullable: row.nullable === true,
      generated: row.generated === true,
    });
  }
  return relations;
};

/**
 * The name of a relation in the contract: its bare name when the search
 * path finds it, and `schema.name` otherwise.
 */
export const keyOf = (relation: Relation): string =>
  relation.visible ? relation.name : `${relation.schema}.${relation.name}`;

/**
 * The columns of each table, for the nullability of the slots a query
 * writes into them. A table is keyed by `schema.name`, and by its bare name
 * when the search path finds it. A view is not written and is left out.
 *
 * @param relations - The relations of the database.
 */
export const columnsOf = (relations: readonly Relation[]): Columns => {
  const columns = new Map<string, { name: string; nullable: boolean }[]>();
  for (const relation of relations) {
    if (relation.kind !== "table") {
      continue;
    }
    const list = relation.columns.map(({ name, nullable }) => ({
      name,
      nullable,
    }));
    columns.set(`${relation.schema}.${relation.name}`, list);
    if (relation.visible) {
      columns.set(relation.name, list);
    }
  }
  return columns;
};
