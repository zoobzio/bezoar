import { describe, expectTypeOf, it } from "vitest";

import type {
  Arguments,
  Query,
  Returns,
  Row,
  RowQuery,
  Type,
  Value,
} from "../src/types";
import type { definition } from "./fixture";

type D = typeof definition;

/**
 * The types derive from the definition. The compiler checks these cases
 * under `tsc --noEmit`. The runtime runs them as empty tests.
 */
describe("Query", () => {
  it("is the union of the query names", () => {
    expectTypeOf<Query<D>>().toEqualTypeOf<
      | "events.list"
      | "events.bySlug"
      | "events.insert"
      | "events.touch"
      | "sermons.recent"
    >();
  });
});

describe("Type", () => {
  it("admits a scalar, an enum, and arrays of them", () => {
    expectTypeOf<"int4">().toMatchTypeOf<Type<D>>();
    expectTypeOf<"event_day">().toMatchTypeOf<Type<D>>();
    expectTypeOf<"event_day[]">().toMatchTypeOf<Type<D>>();
    expectTypeOf<"mood">().not.toMatchTypeOf<Type<D>>();
  });
});

describe("Value", () => {
  it("maps a scalar through the table", () => {
    expectTypeOf<Value<D, "int4">>().toEqualTypeOf<number>();
    expectTypeOf<Value<D, "numeric">>().toEqualTypeOf<string>();
    expectTypeOf<Value<D, "timestamptz">>().toEqualTypeOf<Date>();
    expectTypeOf<Value<D, "jsonb">>().toEqualTypeOf<unknown>();
    expectTypeOf<Value<D, "bytea">>().toEqualTypeOf<Uint8Array>();
  });

  it("maps an enum to its labels", () => {
    expectTypeOf<Value<D, "event_day">>().toEqualTypeOf<
      | "sunday"
      | "monday"
      | "tuesday"
      | "wednesday"
      | "thursday"
      | "friday"
      | "saturday"
    >();
  });

  it("maps an array to an array with nullable elements", () => {
    expectTypeOf<Value<D, "int4[]">>().toEqualTypeOf<(number | null)[]>();
  });

  it("maps an unknown name to unknown", () => {
    expectTypeOf<Value<D, "mood">>().toEqualTypeOf<unknown>();
  });
});

describe("Arguments", () => {
  it("requires a required slot and makes a nullable slot optional", () => {
    expectTypeOf<Arguments<D, "events.list">>().toEqualTypeOf<{
      day:
        | "sunday"
        | "monday"
        | "tuesday"
        | "wednesday"
        | "thursday"
        | "friday"
        | "saturday";
      location?: string | null;
    }>();
  });

  it("takes an array for an array slot", () => {
    expectTypeOf<Arguments<D, "events.touch">>().toEqualTypeOf<{
      ids: (number | null)[];
    }>();
  });
});

describe("Row", () => {
  it("has a member for each column with null where the column is nullable", () => {
    expectTypeOf<Row<D, "events.bySlug">>().toEqualTypeOf<{
      id: number;
      slug: string;
      title: string;
    }>();
    expectTypeOf<Row<D, "events.list">["day"]>().toEqualTypeOf<
      | "sunday"
      | "monday"
      | "tuesday"
      | "wednesday"
      | "thursday"
      | "friday"
      | "saturday"
      | null
    >();
    expectTypeOf<Row<D, "events.list">["weeks"]>().toEqualTypeOf<
      (number | null)[] | null
    >();
  });
});

describe("Returns", () => {
  it("is the rows of a query with a column", () => {
    expectTypeOf<Returns<D, "events.bySlug">>().toEqualTypeOf<
      Row<D, "events.bySlug">[]
    >();
    expectTypeOf<Returns<D, "events.list">>().toEqualTypeOf<
      Row<D, "events.list">[]
    >();
  });

  it("is the count of a query with no column", () => {
    expectTypeOf<Returns<D, "events.insert">>().toEqualTypeOf<number>();
    expectTypeOf<Returns<D, "events.touch">>().toEqualTypeOf<number>();
  });
});

describe("RowQuery", () => {
  it("is the name of each query with a column", () => {
    expectTypeOf<RowQuery<D>>().toEqualTypeOf<
      "events.list" | "events.bySlug" | "sermons.recent"
    >();
  });
});
