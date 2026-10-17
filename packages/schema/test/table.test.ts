import { describe, expect, it } from "vitest";

import { SCALARS } from "../src/constant";
import { TABLE, typeOf } from "../src/table";
import { definition } from "./fixture";

const accepts = (type: string, value: unknown) =>
  typeOf(definition, type).safeParse(value).success;

describe("TABLE", () => {
  it("has a schema for each scalar of the constant", () => {
    expect(Object.keys(TABLE).sort()).toEqual([...SCALARS].sort());
  });

  it("accepts a boolean for bool", () => {
    expect(accepts("bool", true)).toBe(true);
    expect(accepts("bool", "t")).toBe(false);
  });

  it("accepts a safe integer for the integer types", () => {
    expect(accepts("int4", 42)).toBe(true);
    expect(accepts("int4", 4.2)).toBe(false);
    expect(accepts("int8", 2 ** 53)).toBe(false);
    expect(accepts("int8", "1")).toBe(false);
  });

  it("accepts any number for the floating point types", () => {
    expect(accepts("float8", 1.5)).toBe(true);
    expect(accepts("float4", NaN)).toBe(true);
    expect(accepts("float8", Infinity)).toBe(true);
    expect(accepts("float8", "1.5")).toBe(false);
  });

  it("accepts a string for numeric and the text types", () => {
    for (const type of ["numeric", "text", "varchar", "bpchar", "interval"]) {
      expect(accepts(type, "x")).toBe(true);
      expect(accepts(type, 1)).toBe(false);
    }
  });

  it("accepts the form Postgres writes for uuid, date, and time", () => {
    expect(accepts("uuid", "3b241101-e2bb-4255-8caf-4136c566a962")).toBe(true);
    expect(accepts("uuid", "not-a-uuid")).toBe(false);
    expect(accepts("date", "2026-10-16")).toBe(true);
    expect(accepts("date", "10/16/2026")).toBe(false);
    expect(accepts("time", "10:30:00")).toBe(true);
    expect(accepts("time", "10:30:00.123456")).toBe(true);
    expect(accepts("time", "10:30 am")).toBe(false);
  });

  it("accepts a Date for timestamptz and a string for the other temporal types", () => {
    expect(accepts("timestamptz", new Date(0))).toBe(true);
    expect(accepts("timestamptz", "2026-10-16T00:00:00Z")).toBe(false);
    expect(accepts("timestamptz", new Date("bad"))).toBe(false);
    expect(accepts("timestamp", "2026-10-16 09:35:12")).toBe(true);
    expect(accepts("timetz", "09:35:12+00")).toBe(true);
  });

  it("accepts a JSON value for json and jsonb", () => {
    expect(accepts("jsonb", null)).toBe(true);
    expect(accepts("jsonb", { a: [1, "b", true] })).toBe(true);
    expect(accepts("json", undefined)).toBe(false);
    expect(accepts("json", new Date(0))).toBe(false);
  });

  it("accepts a Uint8Array for bytea", () => {
    expect(accepts("bytea", new Uint8Array(1))).toBe(true);
    expect(accepts("bytea", "\\x01")).toBe(false);
  });
});

describe("typeOf", () => {
  it("returns the table schema for a scalar", () => {
    expect(typeOf(definition, "int4")).toBe(TABLE.int4);
  });

  it("makes an enum schema over the labels", () => {
    expect(accepts("event_day", "sunday")).toBe(true);
    expect(accepts("event_day", "someday")).toBe(false);
  });

  it("makes an array schema with null elements allowed", () => {
    expect(accepts("int4[]", [1, null, 3])).toBe(true);
    expect(accepts("int4[]", [1, "2"])).toBe(false);
    expect(accepts("event_day[]", ["sunday", null])).toBe(true);
    expect(accepts("int4[]", 1)).toBe(false);
  });

  it("throws for a name that is not a type of the contract", () => {
    expect(() => typeOf(definition, "money")).toThrow(TypeError);
  });
});
