import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { makeBezoar } from "@bezoar/core";
import { pglite } from "@bezoar/pglite";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { build } from "../src/build";
import { InvalidQueryError } from "../src/error";
import { generate } from "../src/generate";
import { FIXTURE, discard, project } from "./helpers";

describe("the contract of the fixture", () => {
  let contract: Awaited<ReturnType<typeof generate>>["contract"];

  beforeAll(async () => {
    ({ contract } = await generate({ outDir: ".output" }, FIXTURE));
  });

  it("carries the enums of the catalog", () => {
    expect(contract.enums).toEqual({
      event_day: ["sunday", "monday", "tuesday"],
    });
  });

  it("types each slot from the describe of Postgres", () => {
    expect(contract.queries["events.list"]?.slots).toEqual([
      { name: "day", type: "event_day", nullable: false },
    ]);
    expect(contract.queries["events.touch"]?.slots).toEqual([
      { name: "ids", type: "int4[]", nullable: false },
    ]);
    expect(
      contract.queries["events.insert"]?.slots.map((slot) => slot.type),
    ).toEqual(["text", "text", "event_day"]);
  });

  it("makes a slot nullable when the SQL handles its null", () => {
    expect(contract.queries["events.search"]?.slots).toEqual([
      { name: "day", type: "event_day", nullable: true },
      { name: "slug", type: "text", nullable: true },
    ]);
    expect(contract.queries["events.bySlug"]?.slots).toEqual([
      { name: "slug", type: "text", nullable: false },
    ]);
  });

  it("makes a slot nullable when it is written into a column that takes null", () => {
    expect(contract.queries["events.insert"]?.slots).toEqual([
      { name: "slug", type: "text", nullable: false },
      { name: "title", type: "text", nullable: false },
      { name: "day", type: "event_day", nullable: true },
    ]);
    expect(contract.queries["events.rename"]?.slots).toEqual([
      { name: "title", type: "text", nullable: false },
      { name: "weeks", type: "int4[]", nullable: true },
      { name: "id", type: "int4", nullable: false },
    ]);
  });

  it("types each column and takes its nullability from SafeQL", () => {
    expect(contract.queries["events.list"]?.columns).toEqual([
      { name: "id", type: "int4", nullable: false },
      { name: "slug", type: "text", nullable: false },
      { name: "title", type: "text", nullable: false },
      { name: "day", type: "event_day", nullable: false },
      { name: "weeks", type: "int4[]", nullable: true },
      { name: "created_at", type: "timestamptz", nullable: false },
    ]);
  });

  it("marks a column from the nullable side of an outer join nullable", () => {
    expect(contract.queries["admin.staff.leaders"]?.columns).toEqual([
      { name: "id", type: "int4", nullable: false },
      { name: "title", type: "text", nullable: false },
      { name: "leader", type: "text", nullable: true },
    ]);
  });

  it("types a RETURNING row, an aggregate, and a statement without columns", () => {
    expect(contract.queries["events.insert"]?.columns).toEqual([
      { name: "id", type: "int4", nullable: false },
      { name: "created_at", type: "timestamptz", nullable: false },
    ]);
    expect(contract.queries["events.count"]?.columns).toEqual([
      { name: "total", type: "int8", nullable: false },
    ]);
    expect(contract.queries["events.touch"]?.columns).toEqual([]);
  });
});

describe("a query that cannot be built", () => {
  let root: string;

  beforeEach(async () => {
    root = await project();
  });

  afterEach(async () => {
    await discard(root);
  });

  const query = async (file: string, text: string) => {
    const path = join(root, "src/queries", file);
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, text);
    return generate({}, root);
  };

  it("fails with the file and the error of Postgres", async () => {
    const error = query("bad.sql", "SELECT nope FROM events");
    await expect(error).rejects.toThrow(InvalidQueryError);
    await expect(error).rejects.toThrow(/bad\.sql failed: .*nope/);
  });

  it("fails for a column of a type the type table does not have", async () => {
    await expect(
      query("bad.sql", "SELECT '1.2.3.4'::inet AS ip"),
    ).rejects.toThrow(/bad\.sql the column ip has the type inet/);
  });

  it("fails for two columns with one name", async () => {
    await expect(query("bad.sql", "SELECT id, id FROM events")).rejects.toThrow(
      InvalidQueryError,
    );
  });
});

describe("the built package through the service", () => {
  let root: string;
  const executor = pglite();

  beforeAll(async () => {
    root = await project();
    await build({ root });
  });

  afterAll(async () => {
    await executor.close();
    await discard(root);
  });

  it("migrates, seeds, and runs every query", async () => {
    const { contract } = await import(join(root, ".output/index.mjs"));
    const { queries } = await import(join(root, ".output/queries.mjs"));
    const { migrations } = await import(join(root, ".output/migrations.mjs"));
    const { seeds } = await import(join(root, ".output/seeds.mjs"));

    const db = makeBezoar(contract, { executor, queries });
    await db.migrate(migrations);
    await db.seed(seeds);

    expect(await db.query("events.count")).toEqual([{ total: 1 }]);
    expect(await db.first("events.count")).toEqual({ total: 1 });
    expect(await db.query("events.list", { day: "sunday" })).toMatchObject([
      { slug: "worship", day: "sunday", weeks: null },
    ]);
    expect(await db.first("events.bySlug", { slug: "none" })).toBeNull();
    expect(await db.query("events.search")).toMatchObject([
      { slug: "worship" },
    ]);
    expect(await db.query("events.search", { day: "monday" })).toEqual([]);
    expect(
      await db.query("events.search", { day: null, slug: "worship" }),
    ).toMatchObject([{ slug: "worship" }]);
    const inserted = await db.first("events.insert", {
      slug: "study",
      title: "Study",
      day: "monday",
    });
    expect(inserted).toMatchObject({ created_at: expect.any(Date) });
    expect(await db.query("events.touch", { ids: [1, 2] })).toBe(2);
    expect(await db.query("events.rename", { id: 1, title: "Worship" })).toBe(
      1,
    );
    expect(await db.first("events.bySlug", { slug: "worship" })).toEqual({
      id: 1,
      title: "Worship",
    });
    expect(await db.query("admin.staff.leaders")).toMatchObject([
      { leader: null },
      { leader: null },
    ]);
    expect(
      await db.first("events.insert", { slug: "undated", title: "Undated" }),
    ).toMatchObject({ id: expect.any(Number) });
  });

  it("guards a query name", async () => {
    const { isQuery } = await import(join(root, ".output/index.mjs"));
    expect(isQuery("events.list")).toBe(true);
    expect(isQuery("events.all")).toBe(false);
  });
});
