import type { Executor } from "@bezoar/core";
import type { Definition, Statement, Table } from "@bezoar/schema";

import type { Described, Enums, Query, Relation, Roles } from "./types";

import { SCALARS, UNKNOWN } from "@bezoar/schema";
import { within } from "objectively";

import { InvalidQueryError } from "./error";
import { keyOf } from "./tables";

/**
 * The name of each type of a set of OIDs. An array type names its element.
 */
const TYPES = `
  SELECT t.oid::int AS oid, t.typname AS name, e.typname AS element
  FROM pg_type t
  LEFT JOIN pg_type e ON e.oid = t.typelem AND t.typname LIKE '\\_%'
  WHERE t.oid = ANY($1::int[])`;

/**
 * Reads the name of each type the descriptions and the relations refer to,
 * by OID, in the vocabulary of the contract: `int4`, `event_day`, `int4[]`.
 *
 * @param executor - The hermetic database.
 * @param described - The descriptions of the queries.
 * @param relations - The tables and the views of the database.
 */
export const readTypes = async (
  executor: Executor,
  described: ReadonlyMap<string, Described>,
  relations: readonly Relation[] = [],
): Promise<Map<number, string>> => {
  const oids = new Set<number>();
  for (const { params, columns } of described.values()) {
    for (const param of params) {
      oids.add(param.type);
    }
    for (const column of columns) {
      oids.add(column.type);
    }
  }
  for (const relation of relations) {
    for (const column of relation.columns) {
      oids.add(column.type);
    }
  }
  const names = new Map<number, string>();
  if (oids.size === 0) {
    return names;
  }
  const { rows } = await executor.query(TYPES, [[...oids]]);
  for (const row of rows) {
    const element = row.element === null ? undefined : String(row.element);
    names.set(
      Number(row.oid),
      element === undefined ? String(row.name) : `${element}[]`,
    );
  }
  return names;
};

/**
 * Whether a type name is in the vocabulary of the contract: a scalar of the
 * type table or an enum of the database, or an array of one.
 */
const known = (name: string, enums: Enums): boolean => {
  const base = name.endsWith("[]") ? name.slice(0, -2) : name;
  return within(SCALARS, base) || base in enums;
};

/**
 * Builds the contract of a build: the enums of the database, a statement
 * for each query with its slots and columns typed, and a table for each
 * table and view with its columns typed. A query column of a type the type
 * table does not have fails the build. A table column of one is `unknown`,
 * so a table a query never reads still builds. The roles carry the queries
 * each role may run.
 *
 * @param queries - The queries, as read.
 * @param described - The description of each query, by name.
 * @param types - The name of each type, by OID.
 * @param enums - The enums of the hermetic database.
 * @param relations - The tables and the views of the hermetic database.
 * @param roles - The queries each role may run, by role.
 * @throws InvalidQueryError when a slot or a column has a type that is not
 *   a scalar of the type table or an enum of the database.
 */
export const define = (
  queries: readonly Query[],
  described: ReadonlyMap<string, Described>,
  types: ReadonlyMap<number, string>,
  enums: Enums,
  relations: readonly Relation[] = [],
  roles: Roles = {},
): Definition => {
  const statements: Record<string, Statement> = {};

  for (const query of queries) {
    const description = described.get(query.name);
    if (description === undefined) {
      throw new InvalidQueryError(query.path, "was not described");
    }

    const typeOf = (what: string, oid: number): string => {
      const name = types.get(oid) ?? String(oid);
      if (!known(name, enums)) {
        throw new InvalidQueryError(
          query.path,
          `${what} has the type ${name}, which the type table does not have`,
        );
      }
      return name;
    };

    statements[query.name] = {
      slots: query.slots.map((name, index) => {
        const param = description.params[index];
        return {
          name,
          type: typeOf(`the slot :${name}`, param?.type ?? 0),
          nullable: param?.nullable ?? false,
        };
      }),
      columns: description.columns.map((column) => ({
        name: column.name,
        type: typeOf(`the column ${column.name}`, column.type),
        nullable: column.nullable,
      })),
    };
  }

  const tables: Record<string, Table> = {};
  for (const relation of relations) {
    tables[keyOf(relation)] = {
      kind: relation.kind,
      columns: relation.columns.map(({ name, type, nullable, generated }) => {
        const resolved = types.get(type) ?? String(type);
        return {
          name,
          type: known(resolved, enums) ? resolved : UNKNOWN,
          nullable,
          generated,
        };
      }),
    };
  }

  return { enums, queries: statements, tables, roles };
};
