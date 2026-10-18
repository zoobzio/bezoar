import { Kysely } from "kysely";
import { describe, expect, it } from "vitest";

import { defineDialect } from "../src/dialect";
import { fake } from "./fixture";

/** The tables of the test database, for a kysely over the dialect. */
interface Database {
  events: { id: number; title: string };
}

/** A kysely over a fake, and the fake. */
const kyselyOver = (rows: Record<string, unknown>[] = [], count = 0) => {
  let executor = fake(() => ({ rows, count }));
  const db = new Kysely<Database>({
    dialect: defineDialect(() => executor),
  });
  return {
    db,
    get executor() {
      return executor;
    },
    replace: (next: typeof executor) => {
      executor = next;
    },
  };
};

describe("defineDialect", () => {
  it("compiles Postgres and runs each query on the executor", async () => {
    const { db, executor } = kyselyOver([{ id: 1, title: "Worship" }]);
    const rows = await db
      .selectFrom("events")
      .select(["id", "title"])
      .where("id", "=", 1)
      .execute();
    expect(rows).toEqual([{ id: 1, title: "Worship" }]);
    expect(executor.calls).toEqual([
      {
        kind: "query",
        sql: 'select "id", "title" from "events" where "id" = $1',
        params: [1],
        depth: 0,
      },
    ]);
  });

  it("answers a write with the count of the outcome", async () => {
    const { db, executor } = kyselyOver([], 3);
    const result = await db
      .updateTable("events")
      .set({ title: "x" })
      .executeTakeFirst();
    expect(result.numUpdatedRows).toBe(3n);
    expect(executor.calls[0]?.sql).toBe('update "events" set "title" = $1');
  });

  it("reads the executor on each query", async () => {
    const over = kyselyOver([{ id: 1, title: "a" }]);
    await over.db.selectFrom("events").selectAll().execute();
    const other = fake(() => ({ rows: [{ id: 2, title: "b" }], count: 1 }));
    over.replace(other);
    const rows = await over.db.selectFrom("events").selectAll().execute();
    expect(rows).toEqual([{ id: 2, title: "b" }]);
    expect(other.calls).toHaveLength(1);
  });

  it("refuses a transaction of the builder", async () => {
    const { db, executor } = kyselyOver();
    await expect(
      db.transaction().execute(async (trx) => {
        await trx.selectFrom("events").selectAll().execute();
      }),
    ).rejects.toThrow(/a transaction of the builder is not supported/);
    expect(executor.calls).toEqual([]);
  });

  it("refuses a stream", async () => {
    const { db } = kyselyOver();
    const stream = db.selectFrom("events").selectAll().stream();
    await expect(stream.next()).rejects.toThrow(/streaming is not supported/);
  });

  it("has nothing to open or close", async () => {
    const dialect = defineDialect(() => fake());
    const driver = dialect.createDriver();
    await expect(driver.init()).resolves.toBeUndefined();
    const connection = await driver.acquireConnection();
    await expect(driver.releaseConnection(connection)).resolves.toBeUndefined();
    await expect(driver.destroy()).resolves.toBeUndefined();
  });
});
