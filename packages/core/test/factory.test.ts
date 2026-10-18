import { describe, expect, expectTypeOf, it, vi } from "vitest";

import type { Report } from "../src/types";

import {
  InvalidArgumentsError,
  InvalidBundleError,
  InvalidRowError,
  QueryError,
} from "../src/error";
import { makeBezoar } from "../src/factory";
import { contract, fake, queries } from "./fixture";

type Contract = typeof contract;

const rows = [
  { id: 1, title: "Worship", day: "sunday" },
  { id: 2, title: "Study", day: null },
];

/** A service over a fake that answers every query with the rows. */
const service = (
  answer: Record<string, unknown>[] = rows,
  count = answer.length,
) => {
  const executor = fake(() => ({ rows: answer, count }));
  const db = makeBezoar(contract, { executor, queries });
  return { db, executor };
};

describe("makeBezoar", () => {
  it("validates the bundle against the contract", () => {
    const { "events.count": _count, ...partial } = queries;
    void _count;
    expect(() =>
      // @ts-expect-error The bundle lacks a query, which the types also see.
      makeBezoar(contract, { executor: fake(), queries: partial }),
    ).toThrow(InvalidBundleError);
  });

  it("exposes the container and the schema", () => {
    const { db, executor } = service();
    expect(db.config.executor).toBe(executor);
    expect(db.config.queries).toBe(queries);
    expect(db.schema.check.query("events.list")).toBe(true);
  });

  it("has a function for each query under its group", () => {
    const { db } = service();
    expect(typeof db.events.list).toBe("function");
    expect(typeof db.events.count).toBe("function");
  });

  it("puts first on the function of a query with a column only", () => {
    const { db } = service();
    expect(typeof db.events.list.first).toBe("function");
    expect(typeof db.events.bySlug.first).toBe("function");
    expect("first" in db.events.insert).toBe(false);
    expect("first" in db.events.archive).toBe(false);
    // @ts-expect-error A query with no column has no first row.
    void db.events.insert.first;
  });
});

describe("query", () => {
  it("binds the arguments by slot position", async () => {
    const { db, executor } = service();
    await db.events.list({ day: "sunday", location: "Hall" });
    expect(executor.calls[0]).toMatchObject({
      sql: queries["events.list"],
      params: ["sunday", "Hall"],
    });
  });

  it("binds null for an absent nullable slot", async () => {
    const { db, executor } = service();
    await db.events.list({ day: "sunday" });
    expect(executor.calls[0]?.params).toEqual(["sunday", null]);
  });

  it("runs by name as well as by group", async () => {
    const { db, executor } = service([{ id: 1, title: "Worship" }]);
    await db.query("events.bySlug", { slug: "worship" });
    expect(executor.calls[0]?.params).toEqual(["worship"]);
  });

  it("returns the rows of a query with a column", async () => {
    const { db } = service();
    const result = await db.events.list({ day: "sunday" });
    expect(result).toEqual(rows);
    expectTypeOf(result).toEqualTypeOf<
      {
        id: number;
        title: string;
        day: "sunday" | "monday" | "tuesday" | null;
      }[]
    >();
    const { db: one } = service([{ id: 1, title: "Worship" }]);
    const found = await one.events.bySlug({ slug: "worship" });
    expect(found).toEqual([{ id: 1, title: "Worship" }]);
    expectTypeOf(found).toEqualTypeOf<{ id: number; title: string }[]>();
  });

  it("returns the count of a query with no column", async () => {
    const { db } = service([], 3);
    const inserted = await db.events.insert({ title: "New" });
    expect(inserted).toBe(3);
    expectTypeOf(inserted).toEqualTypeOf<number>();
    const archived = await db.events.archive({ ids: [1, 2, 3] });
    expect(archived).toBe(3);
    expectTypeOf(archived).toEqualTypeOf<number>();
  });

  it("takes no arguments for a query with no slot", async () => {
    const { db, executor } = service([{ total: 2 }]);
    expect(await db.events.count()).toEqual([{ total: 2 }]);
    expect(executor.calls[0]?.params).toEqual([]);
  });

  it("rejects arguments that do not fit the slots before it runs", async () => {
    const { db, executor } = service();
    await expect(
      // @ts-expect-error The label is not one of the enum.
      db.events.list({ day: "someday" }),
    ).rejects.toThrow(InvalidArgumentsError);
    // @ts-expect-error The required slot is missing.
    await expect(db.query("events.list", {})).rejects.toThrow(
      InvalidArgumentsError,
    );
    expect(executor.calls).toEqual([]);
  });

  it("rejects a row that does not fit the columns", async () => {
    const { db } = service([{ id: "1", title: "Worship", day: null }]);
    const failing = db.events.list({ day: "sunday" });
    await expect(failing).rejects.toThrow(InvalidRowError);
    await expect(failing).rejects.toMatchObject({
      query: "events.list",
      index: 0,
    });
  });

  it("does not check rows of a query with no column", async () => {
    const { db } = service([{ anything: true }], 1);
    await expect(db.events.insert({ title: "x" })).resolves.toBe(1);
    await expect(db.events.archive({ ids: [1] })).resolves.toBe(1);
  });

  it("wraps a driver failure with the query name", async () => {
    const executor = fake(() => {
      throw new Error("connection lost");
    });
    const db = makeBezoar(contract, { executor, queries });
    const failing = db.events.count();
    await expect(failing).rejects.toThrow(QueryError);
    await expect(failing).rejects.toMatchObject({
      query: "events.count",
      cause: expect.any(Error),
    });
  });

  it("reports each query that ran", async () => {
    const onQuery = vi.fn<(report: Report<Contract>) => void>();
    const executor = fake(() => ({ rows, count: 2 }));
    const db = makeBezoar(contract, { executor, queries }, { onQuery });
    await db.events.list({ day: "sunday" });
    expect(onQuery).toHaveBeenCalledOnce();
    expect(onQuery.mock.calls[0]?.[0]).toMatchObject({
      query: "events.list",
      sql: queries["events.list"],
      arguments: { day: "sunday" },
      count: 2,
    });
    expect(onQuery.mock.calls[0]?.[0].ms).toBeGreaterThanOrEqual(0);
  });

  it("reads the executor of the container on each call", async () => {
    const { db } = service();
    const other = fake(() => ({ rows: [{ total: 9 }], count: 1 }));
    db.config.executor = other;
    expect(await db.events.count()).toEqual([{ total: 9 }]);
    expect(other.calls).toHaveLength(1);
  });
});

describe("first", () => {
  it("returns the first row, under the group and by name", async () => {
    const { db, executor } = service([{ id: 1, title: "Worship" }]);
    const found = await db.events.bySlug.first({ slug: "worship" });
    expect(found).toEqual({ id: 1, title: "Worship" });
    expectTypeOf(found).toEqualTypeOf<{ id: number; title: string } | null>();
    expect(executor.calls[0]?.params).toEqual(["worship"]);

    const { db: counted } = service([{ total: 1 }]);
    const total = await counted.first("events.count");
    expect(total).toEqual({ total: 1 });
    expectTypeOf(total).toEqualTypeOf<{ total: number } | null>();
  });

  it("returns null when there is no row", async () => {
    const { db } = service([]);
    expect(await db.events.bySlug.first({ slug: "none" })).toBeNull();
    expect(await db.first("events.bySlug", { slug: "none" })).toBeNull();
  });

  it("takes only a query with a column by name", async () => {
    const { db } = service([], 1);
    // @ts-expect-error A query with no column has no first row.
    await expect(db.first("events.insert", { title: "x" })).resolves.toBeNull();
  });

  it("proves the row it returns and no other", async () => {
    const { db } = service([
      { id: 1, title: "Worship" },
      { id: "bad", title: 2 },
    ]);
    expect(await db.events.bySlug.first({ slug: "worship" })).toEqual({
      id: 1,
      title: "Worship",
    });
    const failing = db.events.bySlug({ slug: "worship" });
    await expect(failing).rejects.toMatchObject({ index: 1 });
  });

  it("rejects a first row that does not fit the columns", async () => {
    const { db } = service([{ id: "1", title: "Worship" }]);
    const failing = db.events.bySlug.first({ slug: "worship" });
    await expect(failing).rejects.toThrow(InvalidRowError);
    await expect(failing).rejects.toMatchObject({ index: 0 });
  });

  it("reports the query that ran", async () => {
    const onQuery = vi.fn<(report: Report<Contract>) => void>();
    const executor = fake(() => ({ rows, count: 2 }));
    const db = makeBezoar(contract, { executor, queries }, { onQuery });
    await db.events.list.first({ day: "sunday" });
    expect(onQuery.mock.calls[0]?.[0]).toMatchObject({
      query: "events.list",
      count: 2,
    });
  });
});

describe("transaction", () => {
  it("runs the function with a service over the transaction", async () => {
    const { db, executor } = service([{ total: 1 }]);
    const result = await db.transaction(async (tx) => {
      await tx.events.insert({ title: "New" });
      return tx.events.count.first();
    });
    expect(result).toEqual({ total: 1 });
    expect(executor.calls.map((call) => call.depth)).toEqual([1, 1]);
    expect(executor.ends).toEqual(["commit"]);
  });

  it("keeps the bundle and the options", async () => {
    const onQuery = vi.fn();
    const executor = fake(() => ({ rows: [], count: 0 }));
    const db = makeBezoar(contract, { executor, queries }, { onQuery });
    await db.transaction(async (tx) => {
      expect(tx.config.queries).toBe(queries);
      await tx.events.insert({ title: "New" });
    });
    expect(onQuery).toHaveBeenCalledOnce();
  });

  it("rolls back when the function throws", async () => {
    const { db, executor } = service();
    await expect(
      db.transaction(async () => {
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");
    expect(executor.ends).toEqual(["rollback"]);
  });
});

describe("migrate and seed", () => {
  it("run on the executor of the container", async () => {
    const { db, executor } = service([]);
    await db.migrate([
      {
        version: "0001",
        name: "events",
        sql: "CREATE TABLE events ()",
        checksum: "a",
      },
    ]);
    await db.seed([{ name: "events", sql: "INSERT INTO events" }]);
    expect(executor.ends).toEqual(["commit", "commit"]);
  });
});
