import type { Definition } from "./types";

import { z } from "zod";

import { ARRAY, IDENTIFIER, QUERY, SCALARS } from "./constant";

const SCALAR_SET = new Set<string>(SCALARS);

/**
 * A slot or a column: a name, a type name, and a nullable flag.
 * {@link definition} checks the type name against the definition.
 */
const field = z.strictObject({
  name: z.string().min(1),
  type: z.string().min(1),
  nullable: z.boolean(),
});

/**
 * One query: its slots and its columns.
 */
const statement = z.strictObject({
  slots: z.array(field),
  columns: z.array(field),
});

/**
 * An enum name: an identifier that no scalar type uses.
 */
const enumName = z
  .string()
  .regex(IDENTIFIER, "An enum name must be an identifier.")
  .refine(
    (name) => !SCALAR_SET.has(name),
    "An enum name must not be the name of a scalar type.",
  );

/**
 * The members of a definition. {@link definition} adds the checks that read
 * across members.
 */
const shape = z.strictObject({
  enums: z.record(enumName, z.array(z.string().min(1))),
  queries: z.record(
    z.string().regex(QUERY, "A query name must be identifiers joined by dots."),
    statement,
  ),
});

/**
 * Adds an issue for each value that the list holds more than once.
 */
const distinct = (
  ctx: z.RefinementCtx,
  path: PropertyKey[],
  values: string[],
  what: string,
) => {
  const seen = new Set<string>();
  for (const [index, value] of values.entries()) {
    if (seen.has(value)) {
      ctx.addIssue({
        code: "custom",
        message: `${what} '${value}' appears more than once.`,
        path: [...path, index],
      });
    }
    seen.add(value);
  }
};

/**
 * The zod schema of a complete {@link Definition}. Each label list is
 * distinct. Each slot type and each column type is a scalar or an enum of the
 * definition. The slots of a statement have distinct names. The columns of a
 * statement have distinct names.
 */
export const definition: z.ZodType<Definition> = shape.superRefine(
  (value, ctx) => {
    for (const [name, labels] of Object.entries(value.enums)) {
      distinct(ctx, ["enums", name], labels, "Label");
    }

    const known = (type: string) => {
      const base = type.endsWith(ARRAY) ? type.slice(0, -ARRAY.length) : type;
      return SCALAR_SET.has(base) || base in value.enums;
    };

    for (const [name, query] of Object.entries(value.queries)) {
      for (const member of ["slots", "columns"] as const) {
        const fields = query[member];
        const path = ["queries", name, member];
        for (const [index, { type }] of fields.entries()) {
          if (!known(type)) {
            ctx.addIssue({
              code: "custom",
              message: `'${type}' is not a type of the contract.`,
              path: [...path, index, "type"],
            });
          }
        }
        distinct(
          ctx,
          path,
          fields.map((item) => item.name),
          member === "slots" ? "Slot" : "Column",
        );
      }
    }
  },
);
