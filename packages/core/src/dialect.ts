import type {
  CompiledQuery,
  DatabaseConnection,
  Dialect,
  Driver,
  QueryResult,
} from "kysely";

import type { Executor } from "./types";

import {
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from "kysely";

/**
 * The error of a kysely feature the service does not take part in.
 */
const unsupported = (what: string, instead: string): Error =>
  new Error(
    `@bezoar/core: ${what} is not supported by the service; ${instead}`,
  );

/**
 * A connection for kysely over an executor. `executeQuery` runs the compiled
 * SQL with its parameters through the executor and answers with the rows and
 * the count. The connection reads the executor on each query, as the service
 * does, so a caller can replace it. A stream is not supported.
 */
const defineConnection = (executor: () => Executor): DatabaseConnection => ({
  executeQuery: async <R>(compiled: CompiledQuery): Promise<QueryResult<R>> => {
    const outcome = await executor().query(compiled.sql, compiled.parameters);
    return {
      rows: outcome.rows as R[],
      numAffectedRows: BigInt(outcome.count),
    };
  },
  streamQuery: () => {
    throw unsupported("streaming", "run the query and take its rows");
  },
});

/**
 * A driver for kysely over an executor. The driver has one connection and
 * nothing to open or close: the executor owns the connection. A transaction
 * of kysely is refused. The executor opens a transaction as a callback, and
 * the service of a transaction builds on its executor, so a transaction
 * belongs to `db.transaction`.
 */
const defineDriver = (executor: () => Executor): Driver => {
  const connection = defineConnection(executor);
  const refuse = async (): Promise<void> => {
    throw unsupported(
      "a kysely transaction",
      "run `db.transaction((tx) => ...)` and build the query on `tx`",
    );
  };
  return {
    init: async () => {},
    acquireConnection: async () => connection,
    releaseConnection: async () => {},
    beginTransaction: refuse,
    commitTransaction: refuse,
    rollbackTransaction: refuse,
    destroy: async () => {},
  };
};

/**
 * The kysely dialect of a service: the Postgres compiler, adapter, and
 * introspector of kysely, over a driver that runs each compiled query on the
 * executor of the service.
 *
 * @param executor - Reads the executor to run on. Read on each query.
 */
export const defineDialect = (executor: () => Executor): Dialect => ({
  createDriver: () => defineDriver(executor),
  createQueryCompiler: () => new PostgresQueryCompiler(),
  createAdapter: () => new PostgresAdapter(),
  createIntrospector: (db) => new PostgresIntrospector(db),
});
