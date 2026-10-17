import { describe, expect, it } from "vitest";

import { nullableParams } from "../src/nullable";

const nullable = async (sql: string) => [...(await nullableParams(sql))];

describe("nullableParams", () => {
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
