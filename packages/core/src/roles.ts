import type { Executor, Grant } from "./types";

import {
  ACQUIRE,
  DECLARE,
  EXISTS,
  REVOKE,
  ROLES_LOCK,
  SCHEMAS,
} from "./constant";
import { RoleError } from "./error";

/**
 * Makes each role the cluster lacks, as a role that cannot log in. A role
 * that exists is left as it is, so a run on a cluster where the deployment
 * made the roles issues nothing.
 */
const ensure = async (tx: Executor, grants: readonly Grant[]) => {
  for (const grant of grants) {
    const { rows } = await tx.query(EXISTS, [grant.role]);
    if (rows.length === 0) {
      try {
        await tx.exec(DECLARE(grant.role));
      } catch (cause) {
        throw new RoleError(grant.role, cause);
      }
    }
  }
};

/**
 * Makes the roles the cluster lacks, inside one transaction. What a
 * migration needs before it can name a role, in a policy or a grant of its
 * own. Nothing is granted.
 *
 * @param executor - The connection to run on.
 * @param grants - The grants, for the names of their roles.
 */
export const declareRoles = (
  executor: Executor,
  grants: readonly Grant[],
): Promise<void> => executor.transaction((tx) => ensure(tx, grants));

/**
 * Applies the grants: makes the roles the cluster lacks, and for each role
 * revokes every privilege it holds on the objects of each schema and then
 * runs its SQL. The run is one transaction under an advisory lock, so two
 * runs wait for each other and a run is all or nothing. A grant file states
 * the whole of the privileges of its role: a grant removed from the file is
 * gone after the next run. A membership of a role in another, and a default
 * privilege, are not revoked.
 *
 * @param executor - The connection to run on.
 * @param grants - The grants, in the order to apply them.
 */
export const roles = (
  executor: Executor,
  grants: readonly Grant[],
): Promise<void> =>
  executor.transaction(async (tx) => {
    await tx.query(ACQUIRE, [ROLES_LOCK]);
    await ensure(tx, grants);
    const schemas = (await tx.query(SCHEMAS, [])).rows.map((row) =>
      String(row.nspname),
    );
    for (const grant of grants) {
      try {
        for (const schema of schemas) {
          await tx.exec(REVOKE(grant.role, schema));
        }
        await tx.exec(grant.sql);
      } catch (cause) {
        throw new RoleError(grant.role, cause);
      }
    }
  });
