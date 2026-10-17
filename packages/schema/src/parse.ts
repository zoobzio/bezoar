import type { Assert, Definition, Parse } from "./types";

/**
 * Builds the {@link Parse} bundle. Each kind asserts the value and returns it
 * narrowed to the kind type. The {@link SchemaError} from {@link Assert}
 * propagates to the caller.
 */
export const defineParse = <D extends Definition>(
  assert: Assert<D>,
): Parse<D> => {
  return {
    definition: (v) => {
      assert.definition(v);
      return v;
    },
    query: (v) => {
      assert.query(v);
      return v;
    },
    bundle: (v) => {
      assert.bundle(v);
      return v;
    },
    arguments: (query, v) => {
      assert.arguments(query, v);
      return v;
    },
    row: (query, v) => {
      assert.row(query, v);
      return v;
    },
  };
};
