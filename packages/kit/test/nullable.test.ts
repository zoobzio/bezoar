import type { Columns } from "../src/types";

import { describe, expect, it } from "vitest";

import { nullableParams } from "../src/nullable";

/** The events table of the fixture, as the catalog describes it. */
const EVENTS = [
  { name: "id", nullable: false },
  { name: "slug", nullable: false },
  { name: "title", nullable: false },
  { name: "day", nullable: true },
  { name: "weeks", nullable: true },
];

const COLUMNS: Columns = new Map([
  ["events", EVENTS],
  ["public.events", EVENTS],
]);

const nullable = async (sql: string, columns: Columns = new Map()) => [
  ...(await nullableParams(sql, columns)),
];

describe("a slot the SQL handles the null of", () => {
  it("has nothing for a slot the SQL compares", async () => {
    expect(
      await nullable("SELECT id FROM events WHERE day = $1 AND slug = $2"),
    ).toEqual([]);
  });

  it("marks the operand of IS NULL and IS NOT NULL", async () => {
    expect(
      await nullable("SELECT id FROM events WHERE $1 IS NULL OR day = $1"),
    ).toEqual([1]);
    expect(
      await nullable("SELECT id FROM events WHERE $1 IS NOT NULL AND day = $1"),
    ).toEqual([1]);
  });

  it("sees a slot through a cast", async () => {
    expect(
      await nullable(
        "SELECT id FROM events WHERE $1::event_day IS NULL OR day = $1::event_day",
      ),
    ).toEqual([1]);
  });

  it("marks every argument of COALESCE", async () => {
    expect(
      await nullable("SELECT id FROM events WHERE day = COALESCE($1, day)"),
    ).toEqual([1]);
    expect(
      await nullable("SELECT id FROM events WHERE day = COALESCE(day, $1)"),
    ).toEqual([1]);
  });

  it("marks both sides of IS DISTINCT FROM and IS NOT DISTINCT FROM", async () => {
    expect(
      await nullable("SELECT id FROM events WHERE day IS NOT DISTINCT FROM $1"),
    ).toEqual([1]);
    expect(
      await nullable("SELECT id FROM events WHERE $1 IS DISTINCT FROM day"),
    ).toEqual([1]);
  });

  it("keeps a slot in NULLIF required", async () => {
    expect(
      await nullable("SELECT id FROM events WHERE slug = NULLIF($1, '')"),
    ).toEqual([]);
  });

  it("marks only the slots the SQL handles the null of", async () => {
    expect(
      await nullable(
        "SELECT id FROM events WHERE day = $1 AND ($2 IS NULL OR slug = $2) AND title = $3",
      ),
    ).toEqual([2]);
  });

  it("looks inside a CASE, a subquery, and a SET clause", async () => {
    expect(
      await nullable(
        "SELECT id FROM events WHERE CASE WHEN $1 IS NULL THEN true ELSE day = $1 END",
      ),
    ).toEqual([1]);
    expect(
      await nullable(
        "SELECT id FROM events WHERE id IN (SELECT id FROM events WHERE $1 IS NULL OR day = $1)",
      ),
    ).toEqual([1]);
    expect(
      await nullable(
        "UPDATE events SET title = COALESCE($1, title) WHERE id = $2",
      ),
    ).toEqual([1]);
  });
});

describe("a slot written into a column", () => {
  it("is nullable when the column takes null, by the column list", async () => {
    expect(
      await nullable(
        "INSERT INTO events (slug, title, day) VALUES ($1, $2, $3)",
        COLUMNS,
      ),
    ).toEqual([3]);
  });

  it("is nullable by position when the column list is omitted", async () => {
    expect(
      await nullable("INSERT INTO events VALUES ($1, $2, $3, $4, $5)", COLUMNS),
    ).toEqual([4, 5]);
  });

  it("is nullable in every row of VALUES and in an INSERT ... SELECT", async () => {
    expect(
      await nullable(
        "INSERT INTO events (slug, title, day) VALUES ($1, $2, $3), ($4, $5, $6)",
        COLUMNS,
      ),
    ).toEqual([3, 6]);
    expect(
      await nullable(
        "INSERT INTO events (slug, title, weeks) SELECT $1, $2, $3",
        COLUMNS,
      ),
    ).toEqual([3]);
  });

  it("is nullable in a SET clause and in ON CONFLICT DO UPDATE SET", async () => {
    expect(
      await nullable(
        "UPDATE events SET title = $1, weeks = $2 WHERE id = $3",
        COLUMNS,
      ),
    ).toEqual([2]);
    expect(
      await nullable(
        "INSERT INTO events (slug, title) VALUES ($1, $2) ON CONFLICT (slug) DO UPDATE SET day = $3",
        COLUMNS,
      ),
    ).toEqual([3]);
  });

  it("sees a slot through a cast and a schema-qualified table", async () => {
    expect(
      await nullable(
        "INSERT INTO public.events (slug, title, day) VALUES ($1, $2, $3::event_day)",
        COLUMNS,
      ),
    ).toEqual([3]);
  });

  it("stays required for a NOT NULL column, an expression, or an unknown table", async () => {
    expect(
      await nullable("UPDATE events SET slug = $1 WHERE id = $2", COLUMNS),
    ).toEqual([]);
    expect(
      await nullable(
        "INSERT INTO events (slug, title, day) VALUES ($1, $2, lower($3)::event_day)",
        COLUMNS,
      ),
    ).toEqual([]);
    expect(
      await nullable("INSERT INTO staff (name) VALUES ($1)", COLUMNS),
    ).toEqual([]);
  });

  it("stays required in the WHERE of a write", async () => {
    expect(
      await nullable("UPDATE events SET title = $1 WHERE day = $2", COLUMNS),
    ).toEqual([]);
  });
});
