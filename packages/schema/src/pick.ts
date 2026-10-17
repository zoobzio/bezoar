import type { z } from "zod";

import type { Definition, Validators } from "./types";

import { SchemaError } from "./error";

/**
 * Returns the validator of one kind of a query.
 *
 * @param validators - The validators of the contract.
 * @param query - A query name.
 * @param kind - `arguments` or `row`.
 * @throws SchemaError when the name is not a query of the contract.
 */
export const pick = <D extends Definition>(
  validators: Validators<D>,
  query: string,
  kind: "arguments" | "row",
): z.ZodType => {
  const name = validators.query.safeParse(query);
  if (!name.success) {
    throw new SchemaError(name.error.issues);
  }
  return validators.queries[name.data][kind];
};
