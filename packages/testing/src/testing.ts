import type { Options } from "@bezoar/core";
import type { Definition } from "@bezoar/schema";

import type { TestBezoar, TestConfig } from "./types";

import { makeBezoar } from "@bezoar/core";
import { pglite } from "@bezoar/pglite";

/**
 * Builds a {@link Bezoar} service over a fresh PGlite in memory, with the
 * migrations applied and the seeds run. Each call makes its own database.
 * `close` ends it, and so does `await using`.
 *
 * @param definition - The contract: the `contract` export of a build.
 * @param config - The SQL bundle, the migrations, and the seeds of the build.
 * @param options - The runtime features of the service.
 * @throws MigrationError or SeedError when a file fails. The database is
 *   closed first.
 */
export const makeTestBezoar = async <const D extends Definition>(
  definition: D,
  config: TestConfig<D>,
  options: Options<D> = {},
): Promise<TestBezoar<D>> => {
  const executor = pglite();
  const close = () => executor.close();
  const db = makeBezoar(
    definition,
    { executor, queries: config.queries },
    options,
  );
  try {
    await db.migrate(config.migrations);
    await db.seed(config.seeds ?? []);
  } catch (error) {
    await close();
    throw error;
  }
  return Object.assign(db, { close, [Symbol.asyncDispose]: close });
};
