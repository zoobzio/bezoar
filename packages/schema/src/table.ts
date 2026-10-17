import type { Definition, Scalar, Scalars } from "./types";

import { within } from "objectively";
import { z } from "zod";

import { ARRAY, SCALARS } from "./constant";

/**
 * A floating point number. `NaN` and the infinities pass, as Postgres accepts
 * them for `float4` and `float8`.
 */
const floating = z.custom<number>(
  (value) => typeof value === "number",
  "Invalid input: expected number",
);

/**
 * The type table: the zod schema for each scalar type. The table is the one
 * place that maps a Postgres type to its JavaScript form. {@link Scalars}
 * declares the type of each entry.
 *
 * An integer type accepts a safe integer only. A JSON type accepts a JSON
 * value. A temporal type other than `timestamptz` is a string in the form
 * Postgres writes.
 */
export const TABLE: { [S in Scalar]: z.ZodType<Scalars[S]> } = {
  bool: z.boolean(),
  int2: z.int(),
  int4: z.int(),
  int8: z.int(),
  float4: floating,
  float8: floating,
  numeric: z.string(),
  text: z.string(),
  varchar: z.string(),
  bpchar: z.string(),
  uuid: z.uuid(),
  date: z.iso.date(),
  time: z.iso.time(),
  timetz: z.string(),
  timestamp: z.string(),
  timestamptz: z.date(),
  interval: z.string(),
  json: z.json(),
  jsonb: z.json(),
  bytea: z.instanceof(Uint8Array),
};

/**
 * Returns the zod schema for a type name of a contract. A scalar comes from
 * the table. An enum is `z.enum` over its labels. An array is `z.array` of
 * its element. An element can be null. The schema of an array is
 * one-dimensional.
 *
 * @param definition - The contract whose enums the name can refer to.
 * @param type - A type name of the contract.
 * @throws TypeError when the name is not a type of the contract.
 */
export const typeOf = (definition: Definition, type: string): z.ZodType => {
  if (type.endsWith(ARRAY)) {
    return z.array(typeOf(definition, type.slice(0, -ARRAY.length)).nullable());
  }
  const labels = definition.enums[type];
  if (labels) {
    return z.enum(labels);
  }
  if (within(SCALARS, type)) {
    return TABLE[type];
  }
  throw new TypeError(`"${type}" is not a type of the contract.`);
};
