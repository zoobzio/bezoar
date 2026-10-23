import type { Executor } from "@bezoar/core";

import type { GrantFile, Query, Roles } from "./types";

import { quote } from "@bezoar/core";

/**
 * Takes a role for the rest of the transaction.
 */
const take = (role: string): string => `SET LOCAL ROLE ${quote(role)}`;

/**
 * Whether a role may run a query: the database plans the query as the role.
 * The plan runs inside a transaction that takes the role, with a null for
 * each slot, and nothing executes. Planning checks the privileges of the
 * role on each table, column, and function of the query, so a query the
 * role lacks a privilege for fails to plan. A policy of row-level security
 * filters rows and does not fail a plan, so a query under one is still the
 * role's to run.
 */
const permitted = async (
  executor: Executor,
  role: string,
  query: Query,
): Promise<boolean> => {
  try {
    await executor.transaction(async (tx) => {
      await tx.exec(take(role));
      await tx.query(
        `EXPLAIN ${query.sql}`,
        query.slots.map(() => null),
      );
    });
    return true;
  } catch {
    return false;
  }
};

/**
 * Checks every query under every role of a build, after the grants were
 * applied: the queries each role may run, by role, in query name order. A
 * role with a grant that reaches no query has an empty list.
 *
 * @param executor - The hermetic database, with the grants applied.
 * @param queries - The queries of the build.
 * @param grants - The grants of the build.
 */
export const checkRoles = async (
  executor: Executor,
  queries: readonly Query[],
  grants: readonly GrantFile[],
): Promise<Roles> => {
  const roles: Record<string, string[]> = {};
  for (const grant of grants) {
    const allowed: string[] = [];
    for (const query of queries) {
      if (await permitted(executor, grant.role, query)) {
        allowed.push(query.name);
      }
    }
    roles[grant.role] = allowed;
  }
  return roles;
};
