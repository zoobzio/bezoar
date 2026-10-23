import type { Executor } from "@bezoar/core";
import type { Pool, PoolClient, PoolConfig } from "pg";

/**
 * What `pg` takes: a connection string, a pool config, or a pool the caller
 * made.
 */
export type Source = string | PoolConfig | Pool;

/**
 * The options of an executor. `role` scopes it: every connection of the
 * pool takes the role with `SET ROLE` the first time the executor uses it,
 * and keeps it. The pool of a scoped executor is its own: an executor
 * without a role over the same pool would run as the role too.
 */
export interface ExecutorOptions {
  role?: string;
}

/**
 * An {@link Executor} over node-postgres. `pool` is the pool, for a caller
 * that needs more of it than the executor exposes. `close` ends the pool.
 */
export interface PgExecutor extends Executor {
  readonly pool: Pool;
  close(): Promise<void>;
}

/**
 * A connection the executor runs on: the pool, or a client of it inside a
 * transaction.
 */
export type Connection = Pool | PoolClient;

/**
 * Reads the text of one value of a type.
 */
export type Parser = (text: string) => unknown;

/**
 * The state the executors over one pool share. `arrays` is the parser of
 * each array type of a user-defined element, by OID. `changed` is `true`
 * after an `exec` ran and before `arrays` was read again. `role` is the role
 * the executors run as, if any, and `scoped` the clients of the pool that
 * have taken it.
 */
export interface Session {
  readonly pool: Pool;
  arrays: Map<number, Parser>;
  changed: boolean;
  readonly role?: string;
  readonly scoped: WeakSet<PoolClient>;
}
