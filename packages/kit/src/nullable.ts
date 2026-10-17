import type { Node, RangeVar } from "libpg-query";

import type { Columns } from "./types";

import { parse } from "libpg-query";
import { record } from "objectively";

/**
 * The parse tree node under `key`, when `value` is a node of that kind. A
 * node of the tree is an object with one member, named for its kind.
 */
const is = <K extends string>(
  value: Record<string, unknown>,
  key: K,
): value is Record<K, Extract<Node, Record<K, unknown>>[K]> => key in value;

/**
 * The number of the parameter a node is, through any casts: `$1` and
 * `$1::text` are both 1. Any other node is `undefined`.
 */
const paramOf = (node: Node | undefined): number | undefined => {
  if (node === undefined) {
    return undefined;
  }
  if ("TypeCast" in node) {
    return paramOf(node.TypeCast.arg);
  }
  if ("ParamRef" in node) {
    return node.ParamRef.number;
  }
  return undefined;
};

/**
 * The columns of the table a statement writes, or `undefined` when the
 * catalog does not have it.
 */
const tableOf = (columns: Columns, relation: RangeVar | undefined) => {
  if (relation?.relname === undefined) {
    return undefined;
  }
  const { schemaname, relname } = relation;
  return columns.get(
    schemaname === undefined ? relname : `${schemaname}.${relname}`,
  );
};

/**
 * The column a target of a write names, when it names one plainly: `col`,
 * not `col[1]` or `col.field`.
 */
const nameOf = (node: Node | undefined): string | undefined =>
  node !== undefined &&
  "ResTarget" in node &&
  node.ResTarget.indirection === undefined
    ? node.ResTarget.name
    : undefined;

/**
 * The value a target of a write assigns.
 */
const valueOf = (node: Node): Node | undefined =>
  "ResTarget" in node ? node.ResTarget.val : undefined;

/**
 * The rows of values an `INSERT` writes: each row of `VALUES`, or the
 * select list as one row. Any other source has none.
 */
const rowsOf = (node: Node | undefined): (Node | undefined)[][] => {
  if (node === undefined || !("SelectStmt" in node)) {
    return [];
  }
  const { valuesLists, targetList } = node.SelectStmt;
  if (valuesLists !== undefined) {
    return valuesLists.map((row) =>
      "List" in row ? (row.List.items ?? []) : [],
    );
  }
  if (targetList !== undefined) {
    return [targetList.map(valueOf)];
  }
  return [];
};

/**
 * Walks a parse tree and collects the number of each parameter whose null
 * has a meaning: the SQL handles it, as the operand of `IS NULL` or
 * `IS NOT NULL`, an argument of `COALESCE`, or a side of `IS DISTINCT FROM`
 * or `IS NOT DISTINCT FROM`; or the statement writes it into a column that
 * takes null.
 */
const collect = (tree: unknown, columns: Columns): Set<number> => {
  const found = new Set<number>();

  const mark = (node: Node | undefined) => {
    const number = paramOf(node);
    if (number !== undefined) {
      found.add(number);
    }
  };

  /** Marks a value written into a column, when the column takes null. */
  const written = (
    table: ReturnType<typeof tableOf>,
    name: string | undefined,
    value: Node | undefined,
  ) => {
    if (table?.find((column) => column.name === name)?.nullable) {
      mark(value);
    }
  };

  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item);
      }
      return;
    }
    if (!record(value)) {
      return;
    }

    if (is(value, "NullTest")) {
      mark(value.NullTest.arg);
    } else if (is(value, "CoalesceExpr")) {
      for (const arg of value.CoalesceExpr.args ?? []) {
        mark(arg);
      }
    } else if (is(value, "A_Expr")) {
      const { kind, lexpr, rexpr } = value.A_Expr;
      if (kind === "AEXPR_DISTINCT" || kind === "AEXPR_NOT_DISTINCT") {
        mark(lexpr);
        mark(rexpr);
      }
    } else if (is(value, "InsertStmt")) {
      const { relation, cols, selectStmt, onConflictClause } = value.InsertStmt;
      const table = tableOf(columns, relation);
      const names =
        cols === undefined
          ? (table ?? []).map((column) => column.name)
          : cols.map(nameOf);
      for (const row of rowsOf(selectStmt)) {
        for (const [index, item] of row.entries()) {
          written(table, names[index], item);
        }
      }
      for (const target of onConflictClause?.targetList ?? []) {
        written(table, nameOf(target), valueOf(target));
      }
    } else if (is(value, "UpdateStmt")) {
      const { relation, targetList } = value.UpdateStmt;
      const table = tableOf(columns, relation);
      for (const target of targetList ?? []) {
        written(table, nameOf(target), valueOf(target));
      }
    }

    for (const member of Object.values(value)) {
      walk(member);
    }
  };

  walk(tree);
  return found;
};

/**
 * The parameters of a statement whose null has a meaning, by number: `$1`
 * is 1. A parameter counts when any one of its uses, through any cast, is
 * the operand of `IS NULL` or `IS NOT NULL`, an argument of `COALESCE`, or
 * a side of `IS DISTINCT FROM` or `IS NOT DISTINCT FROM`; or when an
 * `INSERT`, an `UPDATE`, or an `ON CONFLICT DO UPDATE` writes it into a
 * column that takes null. `($1 IS NULL OR day = $1)` makes `$1` nullable:
 * the SQL says what a null means. `INSERT INTO events (note) VALUES ($1)`
 * makes `$1` nullable when `note` has no `NOT NULL`: the schema does.
 *
 * @param sql - The SQL of a query, with the slots at their positions.
 * @param columns - The columns of the tables of the database.
 * @throws SqlError of libpg-query when the SQL does not parse. Describe a
 *   query first, so a syntax error carries the message of Postgres.
 */
export const nullableParams = async (
  sql: string,
  columns: Columns,
): Promise<ReadonlySet<number>> => collect(await parse(sql), columns);
