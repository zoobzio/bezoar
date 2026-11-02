import type { Options, Scoping } from "@bezoar/core";
import type { Definition } from "@bezoar/schema";

import type { Database, TestBezoar, TestConfig } from "./types";

import { makeBezoar } from "@bezoar/core";
import { pglite } from "@bezoar/pglite";

/**
 * Opens the database of a service: a client from PGlite options, or the
 * client the function of the config makes.
 */
const open = async (database: Database = {}) =>
  pglite(typeof database === "function" ? await database() : database);

/**
 * Builds a {@link Bezoar} service over a fresh PGlite, in memory unless the
 * config says otherwise, with the roles declared, the migrations applied,
 * the grants applied, and the seeds run. Each call makes its own database.
 * `close` ends it, and so does `await using`.
 *
 * With a role, the service is scoped to it: it offers the queries of the
 * role and runs them as the role, over the same database the owner set up.
 *
 * @param definition - The contract: the `contract` export of a build.
 * @param config - The SQL bundle, the migrations, the seeds, the grants,
 *   and the role of the build, and the database to make.
 * @param options - The runtime features of the service.
 * @throws MigrationError, RoleError, or SeedError when a file fails, and
 *   UnknownRoleError when the contract has no such role. The database is
 *   closed first.
 */
export const makeTestBezoar = async <
  const D extends Definition,
  const R extends Scoping<D> = undefined,
>(
  definition: D,
  config: TestConfig<D, R>,
  options: Options<D> = {},
): Promise<TestBezoar<D, R>> => {
  const executor = await open(config.database);
  const close = () => executor.close();
  const owner = makeBezoar(
    definition,
    { executor, queries: config.queries },
    options,
  );
  const roles = config.roles ?? [];
  try {
    if (roles.length > 0) {
      await owner.roles.declare(roles);
    }
    await owner.migrate(config.migrations);
    if (roles.length > 0) {
      await owner.roles(roles);
    }
    await owner.seed(config.seeds ?? []);
    const db =
      config.role === undefined
        ? (owner as unknown as TestBezoar<D, R>)
        : makeBezoar(
            definition,
            {
              executor: pglite(executor.client, { role: config.role }),
              queries: config.queries,
              role: config.role,
            },
            options,
          );
    return Object.assign(db, { close, [Symbol.asyncDispose]: close });
  } catch (error) {
    await close();
    throw error;
  }
};
