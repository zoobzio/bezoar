import type {
  Arguments,
  Bundle,
  Database,
  Definition,
  Issue,
  Query,
  Returns,
  Role,
  RoleQuery,
  Row,
  RowQuery,
  Schema,
} from "@bezoar/schema";
import type { Compilable, Kysely } from "kysely";

import type { BUILT } from "./constant";

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
 * The role a service is scoped to: a role of the contract, or `undefined`
 * for a service over every query.
 */
export type Scoping<D extends Definition> = Role<D> | undefined;

/**
 * The queries a service scoped to `R` offers: the queries of the role, or
 * every query of the contract when there is no role.
 */
export type Scope<D extends Definition, R extends Scoping<D>> = [R] extends [
  Role<D>,
]
  ? RoleQuery<D, R>
  : Query<D>;

/**
 * The caller-owned state a {@link Bezoar} service reads: the executor it
 * runs on and the SQL of every query. The service reads the executor on each
 * call. A caller can replace it.
 */
export type Config<D extends Definition, R extends Scoping<D> = undefined> = {
  /** The connection the service runs on. */
  executor: Executor;

  /** The SQL of each query, by name, as `@bezoar/kit` built it. */
  queries: Bundle<D>;

  /**
   * The role the service is scoped to. The service offers the queries the
   * kit found the role may run and no other, and the executor is expected
   * to run as the role: a driver takes the role when it connects. Without
   * one, the service offers every query of the contract.
   */
  role?: R;
};

/**
 * What the service reports after a query runs: the name, the SQL, the
 * arguments, the time it took in milliseconds, and the count of the
 * outcome. A built query reports {@link BUILT} as its name, the compiled SQL,
 * and its parameters as the arguments.
 */
export interface Report<D extends Definition> {
  readonly query: Query<D> | typeof BUILT;
  readonly sql: string;
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
 * One grant, as `@bezoar/kit` built it: the name of a role, and the SQL
 * that gives the role its privileges. A grant is not tracked: the runner
 * revokes what the role holds and runs the SQL again, so the SQL states the
 * whole of the privileges of the role.
 */
export interface Grant {
  readonly role: string;
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
 * directory of a query file is its group and the file is its name. `Q` is
 * the queries to offer: every query of the contract, or those of a role.
 */
export type Groups<D extends Definition, Q extends Query<D> = Query<D>> = Tree<
  D,
  Q
>;

/**
 * A validator of a row, in the shape of a zod schema: `safeParse` answers
 * with the value as `R` on success and with the issues on failure. Any zod
 * schema is one.
 */
export interface Validator<R> {
  safeParse(
    value: unknown,
  ):
    | { readonly success: true; readonly data: R }
    | { readonly success: false; readonly error: { readonly issues: Issue[] } };
}

/**
 * Runs a built query: one made with `build` of the service, or any query of
 * the builder that compiles. Without a validator, the rows come
 * back as the builder infers them, unproven. With one, each row is proven
 * against it and comes back as its output, and a row that does not fit is
 * an `InvalidRowError`. The output of the validator must fit the row the
 * builder infers, so a validator that disagrees with the query fails to
 * compile. `first` runs the query and takes its first row, or `null`.
 */
export interface Execute {
  <O>(query: Compilable<O>): Promise<O[]>;
  <O, R extends O>(query: Compilable<O>, row: Validator<R>): Promise<R[]>;
  readonly first: {
    <O>(query: Compilable<O>): Promise<O | null>;
    <O, R extends O>(
      query: Compilable<O>,
      row: Validator<R>,
    ): Promise<R | null>;
  };
}

/**
 * Applies the grants of a build, and `declare` makes their roles alone.
 */
export interface Roles {
  /**
   * Makes the roles the cluster lacks, and applies the grants: for each
   * role, revokes what it holds and runs its SQL, inside one transaction
   * under an advisory lock. Throws `RoleError` when one fails.
   */
  (grants: readonly Grant[]): Promise<void>;

  /**
   * Makes the roles the cluster lacks and grants nothing. What a migration
   * that names a role needs before it runs.
   */
  readonly declare: (grants: readonly Grant[]) => Promise<void>;
}

/**
 * The members of a service other than its queries. A query group cannot
 * take one of these names. `R` is the role the service is scoped to, or
 * `undefined` for a service over every query.
 */
export interface Service<
  D extends Definition,
  R extends Scoping<D> = undefined,
> {
  /**
   * The caller-owned state: the executor, the SQL bundle, and the role.
   */
  config: Config<D, R>;

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
  query: <Q extends Scope<D, R>>(
    query: Q,
    ...args: Args<D, Q>
  ) => Promise<Returns<D, Q>>;

  /**
   * Runs a query with a column by name and returns its first row, or `null`
   * when it has none. The same call as `first` on the function under its
   * group. Proves the row it returns and no other. Throws as `query` does.
   */
  first: <Q extends Scope<D, R> & RowQuery<D>>(
    query: Q,
    ...args: Args<D, Q>
  ) => Promise<Row<D, Q> | null>;

  /**
   * Runs a built query and returns its rows, proven against a validator
   * when one is given. `execute.first` returns the first row or `null`. See
   * {@link Execute}. Throws `QueryError` when the driver fails and
   * `InvalidRowError` when a row does not fit the validator.
   */
  execute: Execute;

  /**
   * The query builder of the service: a [kysely](https://kysely.dev) over
   * the executor of the container, typed by the {@link Database} of the
   * contract. A query built here runs on the executor of the service when
   * it executes. Its own `transaction` is refused: a transaction belongs
   * to `transaction` of the service, and the service of a transaction has
   * a builder of its own.
   */
  build: Kysely<Database<D>>;

  /**
   * Runs a function inside one transaction. The function receives a service
   * over the transaction, with the same queries, builder, and options. The
   * transaction commits when the function returns and rolls back when it
   * throws.
   */
  transaction: <T>(run: (tx: Bezoar<D, R>) => Promise<T>) => Promise<T>;

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

  /**
   * Applies the grants of a build. See {@link Roles}.
   */
  roles: Roles;
}

/**
 * A runtime database service over a contract. The service has its members
 * and, beside them, a function for every query under its group. It never
 * connects: the caller brings an executor from a driver package. A service
 * scoped to a role `R` has a function for the queries of the role alone.
 */
export type Bezoar<
  D extends Definition,
  R extends Scoping<D> = undefined,
> = Service<D, R> & Groups<D, Scope<D, R>>;
