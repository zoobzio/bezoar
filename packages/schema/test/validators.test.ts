import { describe, expect, it } from "vitest";

import { defineValidators } from "../src/validators";
import { definition, eventRow, sermonRow } from "./fixture";

const validators = defineValidators(definition);
const list = validators.queries["events.list"];

describe("defineValidators", () => {
  it("has a validator pair for each query", () => {
    expect(Object.keys(validators.queries).sort()).toEqual(
      Object.keys(definition.queries).sort(),
    );
  });

  it("checks a query name against the names of the contract", () => {
    expect(validators.query.safeParse("events.list").success).toBe(true);
    expect(validators.query.safeParse("events.all").success).toBe(false);
  });

  it("checks a bundle for the SQL of every query and no other", () => {
    const sql = Object.fromEntries(
      Object.keys(definition.queries).map((name) => [name, "SELECT 1"]),
    );
    expect(validators.bundle.safeParse(sql).success).toBe(true);
    const { "events.list": _list, ...partial } = sql;
    void _list;
    expect(validators.bundle.safeParse(partial).success).toBe(false);
    expect(
      validators.bundle.safeParse({ ...sql, "events.all": "SELECT 1" }).success,
    ).toBe(false);
    expect(
      validators.bundle.safeParse({ ...sql, "events.list": 1 }).success,
    ).toBe(false);
  });

  describe("arguments", () => {
    it("accepts the required slots alone", () => {
      expect(list.arguments.safeParse({ day: "sunday" }).success).toBe(true);
    });

    it("accepts a nullable slot as a value, null, or nothing", () => {
      for (const location of ["Hall", null, undefined]) {
        expect(
          list.arguments.safeParse({ day: "sunday", location }).success,
        ).toBe(true);
      }
    });

    it("rejects a missing or null required slot", () => {
      expect(list.arguments.safeParse({ location: "Hall" }).success).toBe(
        false,
      );
      expect(list.arguments.safeParse({ day: null }).success).toBe(false);
    });

    it("rejects a value outside the type of its slot", () => {
      expect(list.arguments.safeParse({ day: "someday" }).success).toBe(false);
      expect(
        list.arguments.safeParse({ day: "sunday", location: 1 }).success,
      ).toBe(false);
    });

    it("rejects a slot the query does not have", () => {
      expect(list.arguments.safeParse({ day: "sunday", week: 1 }).success).toBe(
        false,
      );
    });

    it("takes an array for an array slot", () => {
      const touch = validators.queries["events.touch"].arguments;
      expect(touch.safeParse({ ids: [1, 2] }).success).toBe(true);
      expect(touch.safeParse({ ids: ["1"] }).success).toBe(false);
    });

    it("takes an empty object for a query with no slot", () => {
      const none = defineValidators({
        enums: {},
        queries: { "a.b": { slots: [], columns: [] } },
      });
      expect(none.queries["a.b"].arguments.safeParse({}).success).toBe(true);
    });
  });

  describe("row", () => {
    it("accepts a complete row", () => {
      expect(list.row.safeParse(eventRow).success).toBe(true);
    });

    it("accepts null in a nullable column only", () => {
      expect(
        list.row.safeParse({ ...eventRow, day: null, weeks: null }).success,
      ).toBe(true);
      expect(list.row.safeParse({ ...eventRow, title: null }).success).toBe(
        false,
      );
    });

    it("rejects a missing column and a column the query does not have", () => {
      const { weeks: _weeks, ...partial } = eventRow;
      void _weeks;
      expect(list.row.safeParse(partial).success).toBe(false);
      expect(list.row.safeParse({ ...eventRow, extra: 1 }).success).toBe(false);
    });

    it("rejects a value outside the type of its column", () => {
      expect(list.row.safeParse({ ...eventRow, id: "1" }).success).toBe(false);
      expect(list.row.safeParse({ ...eventRow, weeks: [1, "2"] }).success).toBe(
        false,
      );
    });

    it("checks every scalar family of a row", () => {
      const recent = validators.queries["sermons.recent"].row;
      expect(recent.safeParse(sermonRow).success).toBe(true);
      expect(
        recent.safeParse({ ...sermonRow, published_at: "2026" }).success,
      ).toBe(false);
      expect(recent.safeParse({ ...sermonRow, thumb: "x" }).success).toBe(
        false,
      );
      expect(recent.safeParse({ ...sermonRow, live: "f" }).success).toBe(false);
      expect(recent.safeParse({ ...sermonRow, id: "abc" }).success).toBe(false);
    });
  });
});
