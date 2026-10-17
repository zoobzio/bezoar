import type { Executor } from "@bezoar/core";

import type { Enums } from "./types";

import { SCHEMA } from "./constant";

/**
 * Each enum of the schema with its labels, in declaration order.
 */
const ENUMS = `
  SELECT t.typname AS name,
         array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  JOIN pg_enum e ON e.enumtypid = t.oid
  WHERE n.nspname = $1
  GROUP BY t.typname
  ORDER BY t.typname`;

/**
 * Reads the enums of a database after the migrations ran: each enum type of
 * the schema with its labels, for the contract.
 *
 * @param executor - The database to read.
 */
export const readEnums = async (executor: Executor): Promise<Enums> => {
  const enums: Record<string, string[]> = {};
  for (const row of (await executor.query(ENUMS, [SCHEMA])).rows) {
    enums[String(row.name)] = Array.isArray(row.labels)
      ? row.labels.map(String)
      : [];
  }
  return enums;
};
