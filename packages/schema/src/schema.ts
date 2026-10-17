import type { Definition, Schema } from "./types";

import { assertWith, defineAssert } from "./assert";
import { defineCheck } from "./check";
import { definition } from "./definition";
import { defineInspect } from "./inspect";
import { defineParse } from "./parse";
import { defineValidators } from "./validators";

/**
 * Builds the runtime validation {@link Schema} for the contract of a
 * definition.
 *
 * `validators` holds the zod schemas built from the definition: one for a
 * complete definition, one for a query name, one for the SQL bundle, and
 * for each query one for its arguments and one for its rows. `check` runs
 * them as boolean type predicates. `assert` runs them and throws a
 * {@link SchemaError} with every issue. `parse` asserts the value and returns
 * it narrowed. `inspect` returns the outcome as a {@link Result}.
 *
 * The function validates the definition first. An invalid definition throws
 * at construction.
 *
 * @param base - The definition whose members define the contract.
 * @returns A schema with the validators and the check, assert, parse, and
 *   inspect bundles. The bundles use the query, enum, slot, and column names
 *   of the definition.
 */
export const defineSchema = <const D extends Definition>(
  base: D,
): Schema<D> => {
  assertWith(definition, base);

  const validators = defineValidators(base);
  const check = defineCheck(validators);
  const assert = defineAssert(validators);
  const parse = defineParse(assert);
  const inspect = defineInspect(parse);

  return { base, validators, check, assert, parse, inspect };
};
