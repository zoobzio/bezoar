import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { migrations, seeds } from "./fixture";
import { serve, type Served } from "./helpers";

let served: Served;

beforeAll(async () => {
  served = await serve();
  for (const migration of migrations) {
    await served.executor.exec(migration.sql);
  }
  for (const seed of seeds) {
    await served.executor.exec(seed.sql);
  }
});

afterAll(() => served.stop());

describe("query", () => {
  it("returns rows by column name and the count of rows returned", async () => {
    const { rows, count } = await served.executor.query(
      "SELECT slug FROM events ORDER BY id",
      [],
    );
    expect(rows).toEqual([{ slug: "worship" }, { slug: "study" }]);
    expect(count).toBe(2);
  });

  it("binds positional and array parameters", async () => {
    const { rows } = await served.executor.query(
      "SELECT title FROM events WHERE slug = $1",
      ["worship"],
    );
    expect(rows).toEqual([{ title: "Worship" }]);
    const any = await served.executor.query(
      "SELECT slug FROM events WHERE id = ANY($1) ORDER BY id",
      [[1, 2]],
    );
    expect(any.rows).toHaveLength(2);
  });

  it("returns the count of rows a statement changed", async () => {
    const { count } = await served.executor.query(
      "UPDATE events SET live = live WHERE id = $1",
      [1],
    );
    expect(count).toBe(1);
  });

  it("parses each type as the type table declares", async () => {
    const { rows } = await served.executor.query(
      "SELECT * FROM events WHERE slug = $1",
      ["worship"],
    );
    const row = rows[0]!;
    expect(row.id).toBe(1);
    expect(row.day).toBe("sunday");
    expect(row.days).toEqual(["sunday"]);
    expect(row.weeks).toEqual([1, 3]);
    expect(row.start_time).toBe("10:30:00");
    expect(row.held_on).toBe("2026-10-18");
    expect(row.noted_at).toBe("2026-10-18 10:30:00");
    expect(row.created_at).toBeInstanceOf(Date);
    expect(row.price).toBe("12.50");
    expect(row.meta).toEqual({ a: [1] });
    expect(row.thumb).toBeInstanceOf(Uint8Array);
    expect([...(row.thumb as Uint8Array)]).toEqual([1, 2]);
    expect(row.live).toBe(true);
    expect(row.views).toBe(9007199254740991);
  });

  it("parses null as null", async () => {
    const { rows } = await served.executor.query(
      "SELECT day, weeks, meta FROM events WHERE slug = $1",
      ["study"],
    );
    expect(rows[0]).toEqual({ day: null, weeks: null, meta: null });
  });

  it("parses an int8 beyond the safe range as a bigint, in a column and in an array", async () => {
    const { rows } = await served.executor.query(
      "SELECT 9007199254740993::int8 AS n, ARRAY[1, 9007199254740993]::int8[] AS ns",
      [],
    );
    expect(rows[0]?.n).toBe(9007199254740993n);
    expect(rows[0]?.ns).toEqual([1, 9007199254740993n]);
  });

  it("parses arrays of date and timestamp as strings", async () => {
    const { rows } = await served.executor.query(
      "SELECT ARRAY['2026-10-18'::date] AS d, ARRAY['2026-10-18 10:30:00'::timestamp] AS t",
      [],
    );
    expect(rows[0]).toEqual({ d: ["2026-10-18"], t: ["2026-10-18 10:30:00"] });
  });
});

describe("exec", () => {
  it("runs many statements", async () => {
    await served.executor.exec(
      "CREATE TABLE a (n int); INSERT INTO a VALUES (1), (2);",
    );
    const { rows } = await served.executor.query(
      "SELECT count(*) AS total FROM a",
      [],
    );
    expect(rows[0]?.total).toBe(2);
  });

  it("reads the array of an enum a statement created", async () => {
    await served.executor.exec("CREATE TYPE mood AS ENUM ('glad', 'sad');");
    const { rows } = await served.executor.query(
      "SELECT ARRAY['glad', 'sad']::mood[] AS moods",
      [],
    );
    expect(rows[0]?.moods).toEqual(["glad", "sad"]);
  });

  it("throws the error of the database", async () => {
    const own = await serve();
    await expect(own.executor.exec("SELECT * FROM nowhere")).rejects.toThrow(
      /nowhere/,
    );
    await own.stop();
  });
});

describe("transaction", () => {
  it("commits when the function returns", async () => {
    const result = await served.executor.transaction(async (tx) => {
      await tx.query("INSERT INTO staff (name) VALUES ($1)", ["Ada"]);
      return "done";
    });
    expect(result).toBe("done");
    const { count } = await served.executor.query("SELECT 1 FROM staff", []);
    expect(count).toBe(1);
  });

  it("rolls back when the function throws", async () => {
    await expect(
      served.executor.transaction(async (tx) => {
        await tx.query("INSERT INTO staff (name) VALUES ($1)", ["Bob"]);
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");
    const { count } = await served.executor.query("SELECT 1 FROM staff", []);
    expect(count).toBe(1);
  });

  it("opens a savepoint for a transaction inside a transaction", async () => {
    await served.executor.transaction(async (tx) => {
      await tx.query("INSERT INTO staff (name) VALUES ($1)", ["Cy"]);
      await expect(
        tx.transaction(async (inner) => {
          await inner.query("INSERT INTO staff (name) VALUES ($1)", ["Di"]);
          throw new Error("inner");
        }),
      ).rejects.toThrow("inner");
      await tx.transaction(async (inner) => {
        await inner.query("INSERT INTO staff (name) VALUES ($1)", ["Ed"]);
      });
    });
    const { rows } = await served.executor.query(
      "SELECT name FROM staff ORDER BY id",
      [],
    );
    expect(rows.map((row) => row.name)).toEqual(["Ada", "Cy", "Ed"]);
  });
});
