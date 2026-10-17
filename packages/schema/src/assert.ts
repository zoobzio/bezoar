import type { z } from "zod";

import type { Assert, Definition, Validators } from "./types";

import { SchemaError } from "./error";
import { pick } from "./pick";

/**
 * Runs a validator and throws a {@link SchemaError} with every issue when the
 * value fails.
 */
export const assertWith = (schema: z.ZodType, v: unknown): void => {
  const result = schema.safeParse(v);
  if (!result.success) {
    throw new SchemaError(result.error.issues);
  }
};

/**
 * Builds the {@link Assert} bundle. Each kind is an assertion over its
 * validator. A kind of a query looks the validator up by the query name.
 */
export const defineAssert = <D extends Definition>(
  validators: Validators<D>,
): Assert<D> => {
  return {
    definition: (v) => assertWith(validators.definition, v),
    query: (v) => assertWith(validators.query, v),
    bundle: (v) => assertWith(validators.bundle, v),
    arguments: (query, v) =>
      assertWith(pick(validators, query, "arguments"), v),
    row: (query, v) => assertWith(pick(validators, query, "row"), v),
  };
};
