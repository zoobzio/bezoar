import type { Executor, Outcome } from "@bezoar/core";
import type { Results, Transaction } from "@electric-sql/pglite";

import type { Connection, Session } from "./types";

import { PARSERS, SAVEPOINT } from "./constant";

/**
 * The outcome of a query from the results of PGlite. The count is the rows
 * the statement changed, or the rows it returned when it changed none.
 */
const outcome = (results: Results<Record<string, unknown>>): Outcome => ({
  rows: results.rows,
  count: results.affectedRows || results.rows.length,
});

/**
 * Refreshes the array types of the client after an `exec` ran. A type that a
 * migration creates has an array type the client does not know until then.
 */
const refresh = async (session: Session): Promise<void> => {
  if (session.changed) {
    session.changed = false;
    await session.client.refreshArrayTypes();
  }
};

/**
 * Runs a function inside a savepoint of a transaction. The savepoint is
 * released when the function returns and rolled back to when it throws.
 */
const savepoint = async <T>(
  tx: Transaction,
  depth: number,
  run: () => Promise<T>,
): Promise<T> => {
  const name = `${SAVEPOINT}${depth}`;
  await tx.query(`SAVEPOINT ${name}`);
  try {
    const result = await run();
    await tx.query(`RELEASE SAVEPOINT ${name}`);
    return result;
  } catch (error) {
    await tx.query(`ROLLBACK TO SAVEPOINT ${name}`);
    throw error;
  }
};

/**
 * Builds an executor over a connection at a depth. The depth is zero at the
 * client and one more for each transaction inside.
 */
export const defineExecutor = (
  session: Session,
  connection: Connection,
  depth: number,
): Executor => {
  const query = async (
    sql: string,
    params: readonly unknown[],
  ): Promise<Outcome> =>
    outcome(
      await connection.query<Record<string, unknown>>(sql, [...params], {
        parsers: PARSERS,
      }),
    );

  const exec = async (sql: string): Promise<void> => {
    await connection.exec(sql);
    session.changed = true;
    if (depth === 0) {
      await refresh(session);
    }
  };

  const transaction = async <T>(
    run: (executor: Executor) => Promise<T>,
  ): Promise<T> => {
    if ("transaction" in connection) {
      const result = await connection.transaction((tx) =>
        run(defineExecutor(session, tx, depth + 1)),
      );
      await refresh(session);
      return result;
    }
    return savepoint(connection, depth, () =>
      run(defineExecutor(session, connection, depth + 1)),
    );
  };

  return { query, exec, transaction };
};
