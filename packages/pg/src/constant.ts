import { quote } from "@bezoar/core";

/**
 * The OID of each type the executor parses in its own way, and of the array
 * of each.
 */
export const INT8 = 20;
export const DATE = 1082;
export const TIMESTAMP = 1114;
export const INT8_ARRAY = 1016;
export const DATE_ARRAY = 1182;
export const TIMESTAMP_ARRAY = 1115;

/**
 * The array types whose element is an enum. node-postgres has no parser for
 * them, so the executor reads them and parses each as an array of text.
 */
export const ARRAYS = `
  SELECT t.oid::int AS oid
  FROM pg_type t
  JOIN pg_type e ON e.oid = t.typelem
  WHERE t.typcategory = 'A' AND e.typtype = 'e'`;

/**
 * The prefix of the savepoint a transaction inside a transaction opens. The
 * depth of the transaction follows it.
 */
export const SAVEPOINT = "bezoar_";

/**
 * Takes a role for the rest of the session. A scoped executor runs it once
 * on each connection of its pool, the first time it takes the connection.
 */
export const ROLE = (role: string): string => `SET ROLE ${quote(role)}`;
