import type { Executor } from "@bezoar/core";

import type { Sources } from "./types";

import { InvalidSourceError } from "./error";

/**
 * The message of an error, for a reason.
 */
const reason = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Applies the migrations and the seeds of a project to a database, in
 * order. The database is the hermetic one of a build, so each file runs as
 * it is, with no tracking.
 *
 * @param executor - The database to apply to.
 * @param sources - The SQL of the project.
 * @throws InvalidSourceError, with the error of Postgres as `cause`, when a
 *   file fails.
 */
export const apply = async (
  executor: Executor,
  sources: Sources,
): Promise<void> => {
  for (const file of [...sources.migrations, ...sources.seeds]) {
    try {
      await executor.exec(file.sql);
    } catch (cause) {
      throw new InvalidSourceError(file.path, `failed: ${reason(cause)}`, {
        cause,
      });
    }
  }
};
