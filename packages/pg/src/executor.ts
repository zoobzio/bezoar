import type { Executor, Outcome } from "@bezoar/core";
import type { PoolClient } from "pg";

import type { Connection, Session } from "./types";

import { ARRAYS, SAVEPOINT } from "./constant";
import { arrayOf, typesOf } from "./parsers";

/**
 * Reads the array types of enums when the session has not since the last
 * `exec`. An enum a migration creates has an array type the session does
 * not know until then.
 */
const refresh = async (
  session: Session,
  connection: Connection,
): Promise<void> => {
  if (!session.changed) {
    return;
  }
  session.changed = false;
  const { rows } = await connection.query<{ oid: number }>(ARRAYS);
  session.arrays = new Map(
    rows.map((row) => [row.oid, arrayOf((text) => text)]),
  );
};

/**
 * Runs a function inside a savepoint of a transaction. The savepoint is
 * released when the function returns and rolled back to when it throws.
 */
const savepoint = async <T>(
  client: PoolClient,
  depth: number,
  run: () => Promise<T>,
): Promise<T> => {
  const name = `${SAVEPOINT}${depth}`;
  await client.query(`SAVEPOINT ${name}`);
  try {
    const result = await run();
    await client.query(`RELEASE SAVEPOINT ${name}`);
    return result;
  } catch (error) {
    await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
    throw error;
  }
};

/**
 * Runs a function inside a transaction on a client of the pool. The
 * transaction commits when the function returns and rolls back when it
 * throws. The client returns to the pool after.
 */
const transact = async <T>(
  session: Session,
  run: (client: PoolClient) => Promise<T>,
): Promise<T> => {
  const client = await session.pool.connect();
  try {
    await client.query("BEGIN");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Builds an executor over a connection at a depth. The depth is zero at the
 * pool and one more for each transaction inside.
 */
export const defineExecutor = (
  session: Session,
  connection: Connection,
  depth: number,
): Executor => {
  const query = async (
    sql: string,
    params: readonly unknown[],
  ): Promise<Outcome> => {
    await refresh(session, connection);
    const result = await connection.query<Record<string, unknown>>({
      text: sql,
      values: [...params],
      types: typesOf(session),
    });
    return { rows: result.rows, count: result.rowCount ?? result.rows.length };
  };

  const exec = async (sql: string): Promise<void> => {
    await connection.query(sql);
    session.changed = true;
  };

  const transaction = <T>(
    run: (executor: Executor) => Promise<T>,
  ): Promise<T> => {
    if ("release" in connection) {
      return savepoint(connection, depth, () =>
        run(defineExecutor(session, connection, depth + 1)),
      );
    }
    return transact(session, (client) =>
      run(defineExecutor(session, client, depth + 1)),
    );
  };

  return { query, exec, transaction };
};
