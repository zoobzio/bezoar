import type { Executor } from "@bezoar/core";

import type { GrantFile, Sources } from "./types";

import { RoleError, declareRoles, roles } from "@bezoar/core";

import { InvalidSourceError } from "./error";

/**
 * The message of an error, for a reason.
 */
const reason = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Runs the files in order, each as it is.
 *
 * @throws InvalidSourceError, with the error of Postgres as `cause`, when a
 *   file fails.
 */
const run = async (
  executor: Executor,
  files: readonly { path: string; sql: string }[],
): Promise<void> => {
  for (const file of files) {
    try {
      await executor.exec(file.sql);
    } catch (cause) {
      throw new InvalidSourceError(file.path, `failed: ${reason(cause)}`, {
        cause,
      });
    }
  }
};

/**
 * Runs a phase of the roles runner of `@bezoar/core`, and names the file of
 * the role that failed.
 *
 * @throws InvalidSourceError, with the error of Postgres as `cause`, when a
 *   role fails.
 */
const phase = async (
  grants: readonly GrantFile[],
  go: () => Promise<void>,
): Promise<void> => {
  try {
    await go();
  } catch (error) {
    if (error instanceof RoleError) {
      const file = grants.find((grant) => grant.role === error.role);
      throw new InvalidSourceError(
        file?.path ?? error.role,
        `failed: ${reason(error.cause)}`,
        { cause: error.cause },
      );
    }
    throw error;
  }
};

/**
 * Applies the SQL of a project to a database, in the order the runtime
 * applies it: the roles are declared, the migrations run, the grants are
 * applied through the roles runner of `@bezoar/core`, and the seeds run.
 * The database is the hermetic one of a build, so each file runs as it is,
 * with no tracking. A project without roles runs its migrations and seeds
 * alone.
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
  const grants = sources.roles;
  if (grants.length > 0) {
    await phase(grants, () => declareRoles(executor, grants));
  }
  await run(executor, sources.migrations);
  if (grants.length > 0) {
    await phase(grants, () => roles(executor, grants));
  }
  await run(executor, sources.seeds);
};
