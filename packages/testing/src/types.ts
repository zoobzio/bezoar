import type { Bezoar, Grant, Migration, Scoping, Seed } from "@bezoar/core";
import type { Bundle, Definition } from "@bezoar/schema";

/**
 * What a test service is made from: the SQL bundle, the migrations to
 * apply, the seeds to run, the grants to apply, and the role to scope the
 * service to. Each is an export of a build, but the role.
 */
export interface TestConfig<
  D extends Definition,
  R extends Scoping<D> = undefined,
> {
  /** The SQL of each query, by name. */
  queries: Bundle<D>;

  /** The migrations, applied in order to the fresh database. */
  migrations: readonly Migration[];

  /** The seeds, run in order after the migrations. Defaults to none. */
  seeds?: readonly Seed[];

  /**
   * The grants: the roles are declared before the migrations and the
   * grants applied after them, before the seeds. Defaults to none.
   */
  roles?: readonly Grant[];

  /**
   * The role to scope the service to. The service offers the queries of
   * the role and runs them as the role, as the app does, while the
   * migrations, the grants, and the seeds run as the owner. Needs the
   * grant of the role in `roles`.
   */
  role?: R;
}

/**
 * A {@link Bezoar} service over a database in memory, with `close` to
 * end it. The service is also async disposable, for `await using`.
 */
export type TestBezoar<
  D extends Definition,
  R extends Scoping<D> = undefined,
> = Bezoar<D, R> & {
  close(): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
};
