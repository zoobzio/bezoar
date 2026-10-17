import type { Bezoar, Migration, Seed } from "@bezoar/core";
import type { Bundle, Definition } from "@bezoar/schema";

/**
 * What a test service is made from: the SQL bundle, the migrations to
 * apply, and the seeds to run. Each is an export of a build.
 */
export interface TestConfig<D extends Definition> {
  /** The SQL of each query, by name. */
  queries: Bundle<D>;

  /** The migrations, applied in order to the fresh database. */
  migrations: readonly Migration[];

  /** The seeds, run in order after the migrations. Defaults to none. */
  seeds?: readonly Seed[];
}

/**
 * A {@link Bezoar} service over a database in memory, with `close` to
 * end it. The service is also async disposable, for `await using`.
 */
export type TestBezoar<D extends Definition> = Bezoar<D> & {
  close(): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
};
