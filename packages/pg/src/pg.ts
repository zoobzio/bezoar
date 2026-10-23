import type { Pool as PoolType, PoolClient } from "pg";

import type { ExecutorOptions, PgExecutor, Source } from "./types";

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
 * With a role, every statement runs as the role: each connection of the
 * pool takes it with `SET ROLE` the first time the executor uses the
 * connection. The login user of the pool must be a member of the role. The
 * pool of a scoped executor is its own; for the owner's work, migrations
 * and grants, make a second executor over a pool of its own.
 *
 * @param source - A connection string, a pool config, or a pool. A pool the
 *   caller made stays the caller's to end.
 * @param options - The role to run as, if any.
 */
export const pg = (
  source: Source,
  options: ExecutorOptions = {},
): PgExecutor => {
  let pool: PoolType;
  if (typeof source === "string") {
    pool = new driver.Pool({ connectionString: source });
  } else if ("connect" in source) {
    pool = source;
  } else {
    pool = new driver.Pool(source);
  }
  const session = {
    pool,
    arrays: new Map(),
    changed: true,
    role: options.role,
    scoped: new WeakSet<PoolClient>(),
  };
  const executor = defineExecutor(session, pool, 0);
  return { ...executor, pool, close: () => pool.end() };
};
