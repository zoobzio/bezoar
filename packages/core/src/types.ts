import type {
  Arguments,
  Bundle,
  Definition,
  Query,
  Returns,
  Row,
  RowQuery,
  Schema,
} from "@bezoar/schema";

/**
 * What a driver answers a query with. `rows` is each row as an object, by
 * column name, with the values parsed to the types the schema table
 * declares. `count` is the number of rows the statement changed, or
 * returned when it changed none.
 */
export interface Outcome {
  readonly rows: readonly Record<string, unknown>[];
  readonly count: number;
}

/**
 * A connection to Postgres, as a driver package provides one. The service
 * knows nothing of the driver beyond this.
 *
 * `query` runs one statement with positional parameters, through the
 * extended protocol. `exec` runs text that can hold many statements and no
 * parameters, through the simple protocol. A migration runs through `exec`.
 * `transaction` runs a function with an executor bound to one transaction.
 * The transaction commits when the function returns and rolls back when it
 * throws.
 */
export interface Executor {
  query(sql: string, params: readonly unknown[]): Promise<Outcome>;
  exec(sql: string): Promise<void>;
  transaction<T>(run: (executor: Executor) => Promise<T>): Promise<T>;
}

/**
 * The caller-owned state a {@link Bezoar} service reads: the executor it
 * runs on and the SQL of every query. The service reads the executor on each
 * call. A caller can replace it.
 */
export type Config<D extends Definition> = {
  /** The connection the service runs on. */
  executor: Executor;

  /** The SQL of each query, by name, as `@bezoar/kit` built it. */
  queries: Bundle<D>;
};

/**
 * What the service reports after a query runs: the name, the arguments, the
 * time it took in milliseconds, and the count of the outcome.
 */
export interface Report<D extends Definition> {
  readonly query: Query<D>;
  readonly arguments: unknown;
  readonly ms: number;
  readonly count: number;
}

/**
 * The runtime features of a service.
 */
export type Options<D extends Definition> = {
  /**
   * Called after each query runs, with its {@link Report}. A place for a log
   * or a trace. A transaction shares the option with the service that
   * opened it.
   */
  onQuery?: (report: Report<D>) => void;
};

/**
 * One migration, as `@bezoar/kit` built it: a version that orders it, a
 * name, its SQL, and a checksum of the SQL. The runner keeps the version
 * and the checksum in the database, and refuses a migration whose checksum
 * changed after it was applied.
 */
export interface Migration {
  readonly version: string;
  readonly name: string;
  readonly sql: string;
  readonly checksum: string;
}

/**
 * One seed, as `@bezoar/kit` built it: a name and its SQL. A seed is not
 * tracked. A seed must be safe to run again.
 */
export interface Seed {
  readonly name: string;
  readonly sql: string;
}

/**
 * The arguments a query is called with: its arguments when it has a required
 * slot, and optional arguments when every slot is nullable or there is none.
 */
export type Args<D extends Definition, Q extends Query<D>> =
  Record<never, never> extends Arguments<D, Q>
    ? [args?: Arguments<D, Q>]
    : [args: Arguments<D, Q>];

/**
 * The function of one query. The function takes the arguments of the query
 * and returns its rows, or its count when it has no column. A query with a
 * column also has `first`, which returns the first row or `null`.
 */
export type Method<D extends Definition, Q extends Query<D>> = ((
  ...args: Args<D, Q>
) => Promise<Returns<D, Q>>) &
  (Q extends RowQuery<D>
    ? {
        readonly first: (...args: Args<D, Q>) => Promise<Row<D, Q> | null>;
      }
    : unknown);

/**
 * One level of the {@link Groups}: a function for every name that completes
 * a query name, and the next level for every name that is a group. `K` is
 * what is left of the names below the prefix `P`.
 */
type Tree<D extends Definition, K extends string, P extends string = ""> = {
  readonly [H in Exclude<K, `${string}.${string}`>]: Method<
    D,
    `${P}${H}` & Query<D>
  >;
} & {
  readonly [H in K extends `${infer S}.${string}` ? S : never]: Tree<
    D,
    K extends `${H}.${infer R}` ? R : never,
    `${P}${H}.`
  >;
};

/**
 * The queries of a contract as functions: `db.events.list({ day })`. A dot
 * in a name is a level of the object. The query `events.list` is
 * `db.events.list()`, and its first row is `db.events.list.first()`. The
 * directory of a query file is its group and the file is its name.
 */
export type Groups<D extends Definition> = Tree<D, Query<D>>;

/**
 * The members of a service other than its queries. A query group cannot
 * take one of these names.
 */
export interface Service<D extends Definition> {
  /**
   * The caller-owned state: the executor and the SQL bundle.
   */
  config: Config<D>;

  /**
   * The validation bundle for the contract.
   */
  schema: Schema<D>;

  /**
   * Runs a query by name. The same call as the function under its group.
   * Returns the rows of a query with a column, and the count of the rows
   * the statement changed for one without. Throws `InvalidArgumentsError`
   * when the arguments do not fit the slots, `QueryError` when the driver
   * fails, and `InvalidRowError` when a row does not fit the columns.
   */
  query: <Q extends Query<D>>(
    query: Q,
    ...args: Args<D, Q>
  ) => Promise<Returns<D, Q>>;

  /**
   * Runs a query with a column by name and returns its first row, or `null`
   * when it has none. The same call as `first` on the function under its
   * group. Proves the row it returns and no other. Throws as `query` does.
   */
  first: <Q extends RowQuery<D>>(
    query: Q,
    ...args: Args<D, Q>
  ) => Promise<Row<D, Q> | null>;

  /**
   * Runs a function inside one transaction. The function receives a service
   * over the transaction, with the same queries and options. The transaction
   * commits when the function returns and rolls back when it throws.
   */
  transaction: <T>(run: (tx: Bezoar<D>) => Promise<T>) => Promise<T>;

  /**
   * Applies the migrations the database lacks, in the order given, inside
   * one transaction under an advisory lock. Returns the versions it applied.
   * Throws `MigrationDriftError` when an applied migration has another
   * checksum or is not in the list, and `MigrationError` when one fails.
   */
  migrate: (migrations: readonly Migration[]) => Promise<string[]>;

  /**
   * Runs the seeds, in the order given, inside one transaction. Throws
   * `SeedError` when one fails.
   */
  seed: (seeds: readonly Seed[]) => Promise<void>;
}

/**
 * A runtime database service over a contract. The service has its members
 * and, beside them, a function for every query under its group. It never
 * connects: the caller brings an executor from a driver package.
 */
export type Bezoar<D extends Definition> = Service<D> & Groups<D>;
