import type { z } from "zod";

import type {
  Arguments,
  Bundle,
  Check,
  Definition,
  Query,
  Row,
  Validators,
} from "./types";

import { pick } from "./pick";

/**
 * Builds the {@link Check} bundle. Each kind is a boolean type predicate over
 * its validator. A kind of a query looks the validator up by the query name.
 */
export const defineCheck = <D extends Definition>(
  validators: Validators<D>,
): Check<D> => {
  const check = (schema: z.ZodType, v: unknown) => schema.safeParse(v).success;
  return {
    definition: (v): v is Definition => check(validators.definition, v),
    query: (v): v is Query<D> => check(validators.query, v),
    bundle: (v): v is Bundle<D> => check(validators.bundle, v),
    arguments: <Q extends Query<D>>(
      query: Q,
      v: unknown,
    ): v is Arguments<D, Q> => check(pick(validators, query, "arguments"), v),
    row: <Q extends Query<D>>(query: Q, v: unknown): v is Row<D, Q> =>
      check(pick(validators, query, "row"), v),
  };
};
