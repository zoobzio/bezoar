import type { Definition, Schema } from "@bezoar/schema";

import type { Bezoar, Config, Options } from "./types";

import { defineSchema } from "@bezoar/schema";

import { InvalidBundleError, reframe } from "./error";
import { defineService } from "./service";

/**
 * Builds the runtime {@link Bezoar} service over a contract.
 *
 * The service runs the queries of the contract by name, on the executor the
 * container holds. A call proves its arguments against the slots of the
 * query, binds them by position, runs the SQL of the bundle, proves each row
 * against the columns, and returns the rows, or the count when the query
 * has no column. `first` returns the first row instead. The service never
 * connects: the caller brings an executor from a driver
 * package, and a transaction is the same service over the executor of the
 * transaction.
 *
 * @param definition - The contract: the kit's `contract` export.
 * @param config - The caller-owned container: the executor and the bundle.
 * @param options - The runtime features: a report after each query.
 * @returns A {@link Bezoar} service bound to the container.
 * @throws InvalidBundleError when the bundle does not match the contract.
 * @throws ReservedQueryError when a query group takes a member's name.
 * @throws AmbiguousQueryError when a name is both a query and a group.
 */
export const makeBezoar = <const D extends Definition>(
  definition: D,
  config: Config<D>,
  options: Options<D> = {},
): Bezoar<D> => {
  const schema: Schema<D> = defineSchema(definition);
  reframe(
    (issues) => new InvalidBundleError(issues),
    () => schema.assert.bundle(config.queries),
  );
  return defineService(definition, schema, config, options);
};
