import type { Executor, Seed } from "./types";

import { SeedError } from "./error";

/**
 * Runs the seeds, in order, inside one transaction. A seed that fails rolls
 * the run back.
 *
 * @param executor - The connection to run on.
 * @param seeds - The seeds, in the order to run them.
 */
export const seed = (
  executor: Executor,
  seeds: readonly Seed[],
): Promise<void> =>
  executor.transaction(async (tx) => {
    for (const entry of seeds) {
      try {
        await tx.exec(entry.sql);
      } catch (cause) {
        throw new SeedError(entry.name, cause);
      }
    }
  });
