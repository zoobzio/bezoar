import type { Executor } from "@bezoar/core";
import type {
  PGliteInterface,
  PGliteOptions,
  Transaction,
} from "@electric-sql/pglite";

/**
 * What `pglite` takes: nothing for a database in memory, a path for a
 * database on a data directory, PGlite options, or a client the caller made.
 */
export type Source = string | PGliteOptions | PGliteInterface;

/**
 * An {@link Executor} over PGlite. `client` is the PGlite instance, for a
 * caller that needs more of it than the executor exposes. `close` closes the
 * instance.
 */
export interface PGliteExecutor extends Executor {
  readonly client: PGliteInterface;
  close(): Promise<void>;
}

/**
 * A connection the executor runs on: the client, or a transaction of it.
 */
export type Connection = PGliteInterface | Transaction;

/**
 * The state the executors over one client share. `changed` is `true` after
 * an `exec` ran and before the client refreshed its array types.
 */
export interface Session {
  readonly client: PGliteInterface;
  changed: boolean;
}
