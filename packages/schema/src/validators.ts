import type { Bundle, Definition, Validators } from "./types";

import { keys, map, remap } from "objectively";
import { z } from "zod";

import { definition } from "./definition";
import { typeOf } from "./table";

/**
 * Gives a schema the type that derives from the definition. The schema pipes
 * into `z.custom<V>()`, which declares the type and checks nothing.
 */
const shaped = <V>(schema: z.ZodType): z.ZodType<V> =>
  schema.pipe(z.custom<V>());

/**
 * Builds the zod {@link Validators} for a contract. The arguments schema of a
 * query has a member for each slot: a required slot takes its value, and a
 * nullable slot is optional and also takes `null`. The row schema has a
 * member for each column, with `null` allowed where the column is nullable.
 * Both schemas are strict: a key the statement does not name is an issue.
 * The bundle schema holds the SQL of every query and no other.
 *
 * @param base - The definition whose members define the contract.
 */
export const defineValidators = <D extends Definition>(
  base: D,
): Validators<D> => {
  const queries = remap<D["queries"], Validators<D>["queries"]>(
    base.queries,
    (statement) => {
      const slots: Record<string, z.ZodType> = {};
      for (const slot of statement.slots) {
        const type = typeOf(base, slot.type);
        slots[slot.name] = slot.nullable ? type.nullable().optional() : type;
      }

      const columns: Record<string, z.ZodType> = {};
      for (const column of statement.columns) {
        const type = typeOf(base, column.type);
        columns[column.name] = column.nullable ? type.nullable() : type;
      }

      return {
        arguments: shaped(z.strictObject(slots)),
        row: shaped(z.strictObject(columns)),
      };
    },
  );

  return {
    definition,
    query: z.enum(keys(base.queries)),
    bundle: shaped<Bundle<D>>(
      z.strictObject(map(base.queries, () => z.string().min(1))),
    ),
    queries,
  };
};
