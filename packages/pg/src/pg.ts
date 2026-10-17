import type { Pool as PoolType } from "pg";

import type { PgExecutor, Source } from "./types";

import driver from "pg";

import { defineExecutor } from "./executor";

/**
 * Builds a bezoar `Executor` over node-postgres.
 *
 * `query` runs one statement with positional parameters. The rows match the
 * type table of `@bezoar/schema`. `exec` runs text that can hold many
 * statements. `transaction` runs a function inside a transaction on a client
 * of the pool. A transaction inside a transaction is a savepoint.
 *
 * @param source - A connection string, a pool config, or a pool. A pool the
 *   caller made stays the caller's to end.
 */
export const pg = (source: Source): PgExecutor => {
  let pool: PoolType;
  if (typeof source === "string") {
    pool = new driver.Pool({ connectionString: source });
  } else if ("connect" in source) {
    pool = source;
  } else {
    pool = new driver.Pool(source);
  }
  const session = { pool, arrays: new Map(), changed: true };
  const executor = defineExecutor(session, pool, 0);
  return { ...executor, pool, close: () => pool.end() };
};
