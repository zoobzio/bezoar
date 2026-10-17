import { MigrationError, QueryError } from "@bezoar/core";
import { describe, expect, it, vi } from "vitest";

import { makeTestBezoar } from "../src/testing";
import { contract, migrations, queries, seeds } from "./fixture";

describe("makeTestBezoar", () => {
  it("makes a service with the migrations applied and the seeds run", async () => {
    const db = await makeTestBezoar(contract, {
      queries,
      migrations,
      seeds,
    });
    expect(await db.events.list({ day: "sunday" })).toEqual([
      { id: 1, slug: "worship" },
    ]);
    expect(await db.events.count.first()).toEqual({ total: 1 });
    await db.close();
  });

  it("makes a service without seeds", async () => {
    const db = await makeTestBezoar(contract, { queries, migrations });
    expect(await db.events.count.first()).toEqual({ total: 0 });
    await db.close();
  });

  it("makes its own database for each call", async () => {
    const first = await makeTestBezoar(contract, {
      queries,
      migrations,
      seeds,
    });
    const second = await makeTestBezoar(contract, { queries, migrations });
    expect(await first.events.count.first()).toEqual({ total: 1 });
    expect(await second.events.count.first()).toEqual({ total: 0 });
    await first.close();
    await second.close();
  });

  it("passes the options to the service", async () => {
    const onQuery = vi.fn();
    const db = await makeTestBezoar(
      contract,
      { queries, migrations },
      { onQuery },
    );
    await db.events.count.first();
    expect(onQuery).toHaveBeenCalledOnce();
    await db.close();
  });

  it("closes the database with await using", async () => {
    let kept: Awaited<ReturnType<typeof makeTestBezoar<typeof contract>>>;
    {
      await using db = await makeTestBezoar(contract, {
        queries,
        migrations,
      });
      kept = db;
      expect(await db.events.count.first()).toEqual({ total: 0 });
    }
    await expect(kept.events.count.first()).rejects.toThrow(QueryError);
  });

  it("closes the database and throws when a migration fails", async () => {
    const failing = [
      {
        version: "0001",
        name: "bad",
        sql: "CREATE TABLE t (id nosuchtype);",
        checksum: "x",
      },
    ];
    await expect(
      makeTestBezoar(contract, { queries, migrations: failing }),
    ).rejects.toThrow(MigrationError);
  });
});
