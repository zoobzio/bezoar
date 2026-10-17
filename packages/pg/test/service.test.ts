import type { Bezoar, Migration } from "@bezoar/core";

import { MigrationDriftError, makeBezoar } from "@bezoar/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { contract, migrations, queries, seeds } from "./fixture";
import { serve, type Served } from "./helpers";

let served: Served;
let db: Bezoar<typeof contract>;

beforeAll(async () => {
  served = await serve();
  db = makeBezoar(contract, { executor: served.executor, queries });
});

afterAll(() => served.stop());

describe("a service over pg", () => {
  it("migrates, then has nothing to apply", async () => {
    await expect(db.migrate(migrations)).resolves.toEqual(["0001", "0002"]);
    await expect(db.migrate(migrations)).resolves.toEqual([]);
  });

  it("refuses a migration that changed after it was applied", async () => {
    const changed: Migration[] = [
      { ...migrations[0]!, checksum: "changed" },
      migrations[1]!,
    ];
    await expect(db.migrate(changed)).rejects.toThrow(MigrationDriftError);
  });

  it("seeds, and seeds again without effect", async () => {
    await db.seed(seeds);
    await db.seed(seeds);
    expect(await db.events.count.first()).toEqual({ total: 2 });
  });

  it("runs a query and proves every row", async () => {
    const events = await db.events.list();
    expect(events.map((event) => event.slug)).toEqual(["worship", "study"]);
    expect(events[0]?.created_at).toBeInstanceOf(Date);
    expect(events[0]?.days).toEqual(["sunday"]);
    expect(events[1]?.weeks).toBeNull();
  });

  it("takes the first row, or null when there is none", async () => {
    expect(await db.events.bySlug.first({ slug: "worship" })).toEqual({
      id: 1,
      title: "Worship",
    });
    expect(await db.events.bySlug.first({ slug: "none" })).toBeNull();
  });

  it("returns a RETURNING row and the count of a write", async () => {
    const inserted = await db.events.insert.first({
      slug: "prayer",
      title: "Prayer",
    });
    expect(await db.events.bySlug.first({ slug: "prayer" })).toEqual({
      id: inserted?.id,
      title: "Prayer",
    });
    expect(await db.events.archive({ ids: [1, inserted!.id] })).toBe(2);
  });

  it("rolls a transaction back", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.events.insert({ slug: "gone", title: "Gone" });
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");
    expect(await db.events.bySlug.first({ slug: "gone" })).toBeNull();
  });
});
