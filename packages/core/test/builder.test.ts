import type { Database } from "@bezoar/schema";
import type { Insertable, Updateable } from "kysely";

import { Kysely } from "kysely";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { z } from "zod";

import type { Report } from "../src/types";

import { BUILT } from "../src/constant";
import { InvalidRowError, QueryError } from "../src/error";
import { makeBezoar } from "../src/factory";
import { contract, fake, queries } from "./fixture";

type Contract = typeof contract;

const rows = [
  { id: 1, title: "Worship" },
  { id: 2, title: "Study" },
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

describe("the builder", () => {
  it("is a kysely over the tables of the contract", () => {
    const { db } = service();
    expect(db.build).toBeInstanceOf(Kysely);
    expect(typeof db.build.fn.count).toBe("function");
    // @ts-expect-error The entry points are not members of the service.
    expect(db.selectFrom).toBeUndefined();
  });

  it("builds a select typed by the tables of the contract", async () => {
    const { db, executor } = service();
    const found = await db.build
      .selectFrom("events")
      .select(["id", "title"])
      .where("day", "=", "sunday")
      .orderBy("id")
      .execute();
    expect(found).toEqual(rows);
    expectTypeOf(found).toEqualTypeOf<{ id: number; title: string }[]>();
    expect(executor.calls[0]).toMatchObject({
      sql: 'select "id", "title" from "events" where "day" = $1 order by "id"',
      params: ["sunday"],
    });
    // @ts-expect-error The label is not one of the enum.
    void db.build.selectFrom("events").where("day", "=", "someday");
    // @ts-expect-error The table is not one of the contract.
    void db.build.selectFrom("sermons");
  });

  it("builds an insert with the generated columns optional", async () => {
    const { db, executor } = service([{ id: 3 }], 1);
    const inserted = await db.build
      .insertInto("events")
      .values({ slug: "study", title: "Study", day: null })
      .returning("id")
      .executeTakeFirstOrThrow();
    expect(inserted).toEqual({ id: 3 });
    expectTypeOf(inserted).toEqualTypeOf<{ id: number }>();
    expect(executor.calls[0]).toMatchObject({
      sql: 'insert into "events" ("slug", "title", "day") values ($1, $2, $3) returning "id"',
      params: ["study", "Study", null],
    });
    // @ts-expect-error A title is required.
    void db.build.insertInto("events").values({ slug: "x" });
  });

  it("reads a view, which has no column to insert or update", async () => {
    const { db } = service([{ id: 1, day: "sunday" }]);
    const found = await db.build.selectFrom("dated").selectAll().execute();
    expectTypeOf(found).toEqualTypeOf<
      { id: number; day: "sunday" | "monday" | "tuesday" }[]
    >();
    type Dated = Database<Contract>["dated"];
    expectTypeOf<keyof Insertable<Dated>>().toEqualTypeOf<never>();
    expectTypeOf<keyof Updateable<Dated>>().toEqualTypeOf<never>();
  });

  it("builds a common table expression and a function", async () => {
    const { db, executor } = service([{ total: 2 }]);
    await db.build
      .with("recent", (qb) =>
        qb.selectFrom("events").select("id").where("archived", "=", false),
      )
      .selectFrom("recent")
      .select((eb) => eb.fn.countAll().as("total"))
      .execute();
    expect(executor.calls[0]?.sql).toBe(
      'with "recent" as (select "id" from "events" where "archived" = $1) select count(*) as "total" from "recent"',
    );
  });

  it("runs inside a transaction of the service", async () => {
    const { db, executor } = service();
    await db.transaction(async (tx) => {
      await tx.build.selectFrom("events").selectAll().execute();
      await tx.events.insert({ title: "New" });
    });
    expect(executor.calls.map((call) => call.depth)).toEqual([1, 1]);
    expect(executor.ends).toEqual(["commit"]);
  });

  it("reads the executor of the container on each query", async () => {
    const { db } = service();
    const other = fake(() => ({ rows: [{ id: 9, title: "x" }], count: 1 }));
    db.config.executor = other;
    expect(await db.build.selectFrom("events").selectAll().execute()).toEqual([
      { id: 9, title: "x" },
    ]);
    expect(other.calls).toHaveLength(1);
  });
});

describe("execute", () => {
  const spec = z.object({ id: z.int(), title: z.string() });

  it("returns the rows of a built query, unproven without a validator", async () => {
    const { db, executor } = service([{ id: "1", title: "Worship" }]);
    const query = db.build.selectFrom("events").select(["id", "title"]);
    const found = await db.execute(query);
    expect(found).toEqual([{ id: "1", title: "Worship" }]);
    expectTypeOf(found).toEqualTypeOf<{ id: number; title: string }[]>();
    expect(executor.calls[0]?.sql).toBe('select "id", "title" from "events"');
  });

  it("proves each row against a validator and returns its output", async () => {
    const { db } = service();
    const query = db.build.selectFrom("events").select(["id", "title"]);
    const found = await db.execute(query, spec);
    expect(found).toEqual(rows);
    expectTypeOf(found).toEqualTypeOf<{ id: number; title: string }[]>();
  });

  it("rejects a row that does not fit the validator", async () => {
    const { db } = service([rows[0]!, { id: "2", title: "Study" }]);
    const failing = db.execute(
      db.build.selectFrom("events").select(["id", "title"]),
      spec,
    );
    await expect(failing).rejects.toThrow(InvalidRowError);
    await expect(failing).rejects.toMatchObject({ query: BUILT, index: 1 });
  });

  it("refuses a validator that disagrees with the query", () => {
    const { db } = service();
    const query = db.build.selectFrom("events").select(["id", "title"]);
    const refused = [
      // @ts-expect-error The validator types id as a string.
      db.execute(query, z.object({ id: z.string(), title: z.string() })),
      // @ts-expect-error The validator lacks a column of the query.
      db.execute(query, z.object({ id: z.int() })),
    ];
    return expect(Promise.allSettled(refused)).resolves.toMatchObject([
      { status: "rejected" },
      { status: "fulfilled" },
    ]);
  });

  it("takes the first row, or null", async () => {
    const { db } = service();
    const query = db.build.selectFrom("events").select(["id", "title"]);
    const first = await db.execute.first(query, spec);
    expect(first).toEqual(rows[0]);
    expectTypeOf(first).toEqualTypeOf<{ id: number; title: string } | null>();
    expect(await db.execute.first(query)).toEqual(rows[0]);
    const { db: empty } = service([]);
    expect(await empty.execute.first(query)).toBeNull();
    expect(await empty.execute.first(query, spec)).toBeNull();
  });

  it("proves the first row and no other", async () => {
    const { db } = service([rows[0]!, { id: "bad", title: 2 }]);
    const query = db.build.selectFrom("events").select(["id", "title"]);
    expect(await db.execute.first(query, spec)).toEqual(rows[0]);
    await expect(db.execute(query, spec)).rejects.toMatchObject({ index: 1 });
  });

  it("wraps a driver failure", async () => {
    const executor = fake(() => {
      throw new Error("connection lost");
    });
    const db = makeBezoar(contract, { executor, queries });
    const failing = db.execute(db.build.selectFrom("events").selectAll());
    await expect(failing).rejects.toThrow(QueryError);
    await expect(failing).rejects.toMatchObject({
      query: BUILT,
      cause: expect.any(Error),
    });
  });

  it("reports the built query with its SQL and parameters", async () => {
    const onQuery = vi.fn<(report: Report<Contract>) => void>();
    const executor = fake(() => ({ rows, count: 2 }));
    const db = makeBezoar(contract, { executor, queries }, { onQuery });
    await db.execute(
      db.build.selectFrom("events").select("id").where("title", "=", "Worship"),
    );
    expect(onQuery).toHaveBeenCalledOnce();
    expect(onQuery.mock.calls[0]?.[0]).toMatchObject({
      query: BUILT,
      sql: 'select "id" from "events" where "title" = $1',
      arguments: ["Worship"],
      count: 2,
    });
    expect(onQuery.mock.calls[0]?.[0].ms).toBeGreaterThanOrEqual(0);
  });

  it("does not report a query that runs through the builder directly", async () => {
    const onQuery = vi.fn();
    const executor = fake(() => ({ rows, count: 2 }));
    const db = makeBezoar(contract, { executor, queries }, { onQuery });
    await db.build.selectFrom("events").selectAll().execute();
    expect(onQuery).not.toHaveBeenCalled();
  });
});
