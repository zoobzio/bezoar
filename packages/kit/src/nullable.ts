import type { Node } from "libpg-query";

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
 * Walks a parse tree and collects the number of each parameter in a
 * position where the SQL handles its null: the operand of `IS NULL` or
 * `IS NOT NULL`, an argument of `COALESCE`, or a side of `IS DISTINCT FROM`
 * or `IS NOT DISTINCT FROM`.
 */
const walk = (value: unknown, found: Set<number>): void => {
  if (Array.isArray(value)) {
    for (const item of value) {
      walk(item, found);
    }
    return;
  }
  if (!record(value)) {
    return;
  }

  const mark = (node: Node | undefined) => {
    const number = paramOf(node);
    if (number !== undefined) {
      found.add(number);
    }
  };

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
  }

  for (const member of Object.values(value)) {
    walk(member, found);
  }
};

/**
 * The parameters of a statement that the SQL treats a null as meaningful
 * for, by number: `$1` is 1. A parameter counts when any one of its uses is
 * the operand of `IS NULL` or `IS NOT NULL`, an argument of `COALESCE`, or a
 * side of `IS DISTINCT FROM` or `IS NOT DISTINCT FROM`, through any cast.
 * `($1 IS NULL OR day = $1)` makes `$1` nullable: the SQL says what a null
 * means, so the service can bind one.
 *
 * @param sql - The SQL of a query, with the slots at their positions.
 * @throws SqlError of libpg-query when the SQL does not parse. Describe a
 *   query first, so a syntax error carries the message of Postgres.
 */
export const nullableParams = async (
  sql: string,
): Promise<ReadonlySet<number>> => {
  const found = new Set<number>();
  walk(await parse(sql), found);
  return found;
};
