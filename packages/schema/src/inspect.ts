import type { Definition, Inspect, Parse, Result } from "./types";

import { SchemaError } from "./error";

/**
 * Runs a parse and returns a {@link Result}. A success result holds the
 * narrowed value. A failure result holds the issues. Errors of other types
 * propagate to the caller.
 */
const inspectWith = <V>(parse: () => V): Result<V> => {
  try {
    return { success: true, data: parse() };
  } catch (error) {
    if (error instanceof SchemaError) {
      return { success: false, issues: error.issues };
    }
    throw error;
  }
};

/**
 * Builds the {@link Inspect} bundle. Each kind runs its {@link Parse} and
 * returns a {@link Result}.
 */
export const defineInspect = <D extends Definition>(
  parse: Parse<D>,
): Inspect<D> => {
  return {
    definition: (v) => inspectWith(() => parse.definition(v)),
    query: (v) => inspectWith(() => parse.query(v)),
    bundle: (v) => inspectWith(() => parse.bundle(v)),
    arguments: (query, v) => inspectWith(() => parse.arguments(query, v)),
    row: (query, v) => inspectWith(() => parse.row(query, v)),
  };
};
