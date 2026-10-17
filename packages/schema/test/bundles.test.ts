import { describe, expect, it } from "vitest";

import type { Assert } from "../src/types";

import { defineAssert } from "../src/assert";
import { defineCheck } from "../src/check";
import { SchemaError } from "../src/error";
import { defineInspect } from "../src/inspect";
import { defineParse } from "../src/parse";
import { defineValidators } from "../src/validators";
import { definition, eventRow } from "./fixture";

const validators = defineValidators(definition);
const check = defineCheck(validators);
const assert: Assert<typeof definition> = defineAssert(validators);
const parse = defineParse(assert);
const inspect = defineInspect(parse);

const kinds = ["arguments", "bundle", "definition", "query", "row"];

/** A bundle with the SQL of every query of the fixture. */
const sql = Object.fromEntries(
  Object.keys(definition.queries).map((name) => [name, `SELECT '${name}'`]),
);

describe("defineCheck", () => {
  it("has a predicate for each kind", () => {
    expect(Object.keys(check).sort()).toEqual(kinds);
  });

  it("answers true for a valid value and false for an invalid one", () => {
    expect(check.definition(definition)).toBe(true);
    expect(check.definition({})).toBe(false);
    expect(check.query("events.list")).toBe(true);
    expect(check.query("events.all")).toBe(false);
    expect(check.bundle(sql)).toBe(true);
    expect(check.bundle({ ...sql, "events.all": "SELECT 1" })).toBe(false);
    expect(check.bundle({ ...sql, "events.list": "" })).toBe(false);
    expect(check.arguments("events.list", { day: "sunday" })).toBe(true);
    expect(check.arguments("events.list", { day: "someday" })).toBe(false);
    expect(check.row("events.list", eventRow)).toBe(true);
    expect(check.row("events.list", {})).toBe(false);
  });

  it("throws for a query name the contract does not have", () => {
    // @ts-expect-error The name is not a query of the contract.
    expect(() => check.arguments("events.all", {})).toThrow(SchemaError);
  });
});

describe("defineAssert", () => {
  it("has an assertion for each kind", () => {
    expect(Object.keys(assert).sort()).toEqual(kinds);
  });

  it("returns for a valid value and throws a SchemaError for an invalid one", () => {
    expect(() => assert.definition(definition)).not.toThrow();
    expect(() => assert.definition({})).toThrow(SchemaError);
    expect(() => assert.query("events.list")).not.toThrow();
    expect(() => assert.query("events.all")).toThrow(SchemaError);
    expect(() =>
      assert.arguments("events.list", { day: "sunday" }),
    ).not.toThrow();
    expect(() => assert.arguments("events.list", {})).toThrow(SchemaError);
    expect(() => assert.row("events.list", eventRow)).not.toThrow();
    expect(() => assert.row("events.list", { ...eventRow, id: "1" })).toThrow(
      SchemaError,
    );
  });

  it("collects every issue of the pass with its path", () => {
    try {
      assert.row("events.list", { ...eventRow, id: "1", extra: true });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SchemaError);
      if (error instanceof SchemaError) {
        const paths = error.issues.map((issue) => issue.path.join("."));
        expect(paths).toEqual(["id", ""]);
      }
    }
  });
});

describe("defineParse", () => {
  it("has a parse function for each kind", () => {
    expect(Object.keys(parse).sort()).toEqual(kinds);
  });

  it("returns the value it was given", () => {
    expect(parse.definition(definition)).toBe(definition);
    expect(parse.query("events.list")).toBe("events.list");
    const args = { day: "sunday" };
    expect(parse.arguments("events.list", args)).toBe(args);
    expect(parse.row("events.list", eventRow)).toBe(eventRow);
  });

  it("propagates the SchemaError of the assertion", () => {
    expect(() => parse.query("events.all")).toThrow(SchemaError);
    expect(() => parse.row("events.list", {})).toThrow(SchemaError);
  });
});

describe("defineInspect", () => {
  it("has an inspect function for each kind", () => {
    expect(Object.keys(inspect).sort()).toEqual(kinds);
  });

  it("returns a success result with the value", () => {
    expect(inspect.query("events.list")).toEqual({
      success: true,
      data: "events.list",
    });
    expect(inspect.row("events.list", eventRow)).toEqual({
      success: true,
      data: eventRow,
    });
  });

  it("returns a failure result with the issues", () => {
    const result = inspect.arguments("events.list", { day: "someday" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]?.path).toEqual(["day"]);
    }
  });

  it("propagates an error that is not a SchemaError", () => {
    const failing = defineInspect({
      ...parse,
      query: () => {
        throw new TypeError("other");
      },
    });
    expect(() => failing.query("events.list")).toThrow(TypeError);
  });
});
