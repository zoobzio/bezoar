import { describe, expect, it } from "vitest";

import { SchemaError } from "../src/error";
import { defineSchema } from "../src/schema";
import { definition, eventRow } from "./fixture";

const schema = defineSchema(definition);

describe("defineSchema", () => {
  it("returns the base, the validators, and the bundles", () => {
    expect(Object.keys(schema).sort()).toEqual([
      "assert",
      "base",
      "check",
      "inspect",
      "parse",
      "validators",
    ]);
  });

  it("keeps the source definition as base", () => {
    expect(schema.base).toBe(definition);
  });

  it("exposes the zod validators for direct use", () => {
    expect(
      schema.validators.queries["events.list"].row.safeParse(eventRow).success,
    ).toBe(true);
    expect(schema.validators.query.safeParse("events.all").success).toBe(false);
  });

  it("wires check, assert, parse, and inspect off the same validators", () => {
    expect(schema.check.definition(definition)).toBe(true);
    expect(() => schema.assert.query("events.list")).not.toThrow();
    expect(schema.parse.arguments("events.list", { day: "sunday" })).toEqual({
      day: "sunday",
    });
    expect(schema.inspect.row("events.list", {}).success).toBe(false);
  });

  it("validates the definition at construction", () => {
    expect(() =>
      defineSchema({
        enums: {},
        queries: {
          "events.list": {
            slots: [{ name: "x", type: "money", nullable: false }],
            columns: [],
          },
        },
      }),
    ).toThrow(SchemaError);
  });

  it("constructs cleanly for an empty definition", () => {
    expect(() => defineSchema({ enums: {}, queries: {} })).not.toThrow();
  });
});
