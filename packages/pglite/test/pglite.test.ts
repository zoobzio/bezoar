import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { pglite } from "../src/pglite";
import { migrations, seeds } from "./fixture";

const executor = pglite();

beforeAll(async () => {
  for (const migration of migrations) {
    await executor.exec(migration.sql);
  }
  for (const seed of seeds) {
    await executor.exec(seed.sql);
  }
});

afterAll(() => executor.close());

describe("query", () => {
  it("returns rows by column name and the count of rows returned", async () => {
    const { rows, count } = await executor.query(
      "SELECT slug FROM events ORDER BY id",
      [],
    );
    expect(rows).toEqual([{ slug: "worship" }, { slug: "study" }]);
    expect(count).toBe(2);
  });

  it("binds positional parameters", async () => {
    const { rows } = await executor.query(
      "SELECT title FROM events WHERE slug = $1",
      ["worship"],
    );
    expect(rows).toEqual([{ title: "Worship" }]);
  });

  it("binds an array parameter", async () => {
    const { rows } = await executor.query(
      "SELECT slug FROM events WHERE id = ANY($1) ORDER BY id",
      [[1, 2]],
    );
    expect(rows).toHaveLength(2);
  });

  it("returns the count of rows a statement changed", async () => {
    const { count } = await executor.query(
      "UPDATE events SET live = live WHERE id = $1",
      [1],
    );
    expect(count).toBe(1);
  });

  it("parses each type as the type table declares", async () => {
    const { rows } = await executor.query(
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
    expect(row.thumb).toEqual(new Uint8Array([1, 2]));
    expect(row.live).toBe(true);
    expect(row.views).toBe(9007199254740991);
  });

  it("parses null as null", async () => {
    const { rows } = await executor.query(
      "SELECT day, weeks, meta FROM events WHERE slug = $1",
      ["study"],
    );
    expect(rows[0]).toEqual({ day: null, weeks: null, meta: null });
  });

  it("parses an int8 beyond the safe range as a bigint", async () => {
    const { rows } = await executor.query(
      "SELECT 9007199254740993::int8 AS n",
      [],
    );
    expect(rows[0]?.n).toBe(9007199254740993n);
  });
});

describe("exec", () => {
  it("runs many statements", async () => {
    await executor.exec(
      "CREATE TABLE a (n int); INSERT INTO a VALUES (1), (2);",
    );
    const { rows } = await executor.query(
      "SELECT count(*) AS total FROM a",
      [],
    );
    expect(rows[0]?.total).toBe(2);
  });

  it("refreshes the array types for a type a statement created", async () => {
    await executor.exec("CREATE TYPE mood AS ENUM ('glad', 'sad');");
    const { rows } = await executor.query(
      "SELECT ARRAY['glad', 'sad']::mood[] AS moods",
      [],
    );
    expect(rows[0]?.moods).toEqual(["glad", "sad"]);
  });

  it("throws the error of the database", async () => {
    await expect(executor.exec("SELECT * FROM nowhere")).rejects.toThrow(
      /nowhere/,
    );
  });
});

describe("transaction", () => {
  it("commits when the function returns", async () => {
    const result = await executor.transaction(async (tx) => {
      await tx.query("INSERT INTO staff (name) VALUES ($1)", ["Ada"]);
      return "done";
    });
    expect(result).toBe("done");
    const { count } = await executor.query("SELECT 1 FROM staff", []);
    expect(count).toBe(1);
  });

  it("rolls back when the function throws", async () => {
    await expect(
      executor.transaction(async (tx) => {
        await tx.query("INSERT INTO staff (name) VALUES ($1)", ["Bob"]);
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");
    const { count } = await executor.query("SELECT 1 FROM staff", []);
    expect(count).toBe(1);
  });

  it("opens a savepoint for a transaction inside a transaction", async () => {
    await executor.transaction(async (tx) => {
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
    const { rows } = await executor.query(
      "SELECT name FROM staff ORDER BY id",
      [],
    );
    expect(rows.map((row) => row.name)).toEqual(["Ada", "Cy", "Ed"]);
  });

  it("refreshes the array types after a transaction that created a type", async () => {
    await executor.transaction(async (tx) => {
      await tx.exec("CREATE TYPE tone AS ENUM ('low', 'high');");
    });
    const { rows } = await executor.query(
      "SELECT ARRAY['low']::tone[] AS tones",
      [],
    );
    expect(rows[0]?.tones).toEqual(["low"]);
  });
});
