import type { PGliteInterface } from "@electric-sql/pglite";

import type { ExecutorOptions, PGliteExecutor, Source } from "./types";

import { PGlite } from "@electric-sql/pglite";

import { defineExecutor } from "./executor";

/**
 * Builds a bezoar `Executor` over PGlite.
 *
 * `query` runs one statement with positional parameters. The rows match the
 * type table of `@bezoar/schema`. `exec` runs text that can hold many
 * statements, and then refreshes the array types of the client, so an array
 * of a type a migration created parses as an array. `transaction` runs a
 * function inside a transaction of the client. A transaction inside a
 * transaction is a savepoint.
 *
 * With a role, every statement runs as the role: `SET LOCAL ROLE` inside a
 * transaction the executor opens around it. The session of the client keeps
 * its own role, so an executor without one over the same client, as
 * `pglite(client)` makes, applies migrations and grants as the owner while
 * the scoped one runs queries as the role.
 *
 * @param source - Nothing for a database in memory, a path to a data
 *   directory, PGlite options, or a client. A client the caller made stays
 *   the caller's to close.
 * @param options - The role to run as, if any.
 */
export const pglite = (
  source: Source = {},
  options: ExecutorOptions = {},
): PGliteExecutor => {
  let client: PGliteInterface;
  if (typeof source === "string") {
    client = new PGlite(source);
  } else if ("query" in source) {
    client = source;
  } else {
    client = new PGlite(source);
  }
  const executor = defineExecutor(
    { client, changed: false, role: options.role },
    client,
    0,
  );
  const close = async () => {
    await client.waitReady;
    await client.close();
  };
  return { ...executor, client, close };
};
