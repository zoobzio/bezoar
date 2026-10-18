import { pglite } from "@bezoar/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Relation } from "../src/types";

import { apply } from "../src/apply";
import { readSources } from "../src/read";
import { columnsOf, keyOf, readRelations } from "../src/tables";
import { FIXTURE } from "./helpers";

const settings = {
  migrations: "src/migrations",
  seeds: "src/seeds",
  queries: "src/queries",
  outDir: ".output",
};

const executor = pglite();
let relations: Relation[];

beforeAll(async () => {
  await apply(executor, await readSources(FIXTURE, settings));
  await executor.exec(`
    CREATE SCHEMA audit;
    CREATE TABLE audit.events (id int PRIMARY KEY, note text);
  `);
  relations = await readRelations(executor);
});

afterAll(() => executor.close());

/** The relation of the fixture with a name. */
const named = (schema: string, name: string) =>
  relations.find((r) => r.schema === schema && r.name === name);

describe("readRelations", () => {
  it("reads each table and view with where it lives and whether it is visible", () => {
    expect(relations.map((r) => [r.schema, r.name, r.kind, r.visible])).toEqual(
      [
        ["audit", "events", "table", false],
        ["public", "dated", "view", true],
        ["public", "events", "table", true],
        ["public", "leaders", "table", true],
        ["public", "staff", "table", true],
        ["public", "visits", "table", true],
      ],
    );
  });

  it("reads the columns in declaration order with whether each takes null", () => {
    expect(
      named("public", "events")?.columns.map(({ name, nullable }) => [
        name,
        nullable,
      ]),
    ).toEqual([
      ["id", false],
      ["slug", false],
      ["title", false],
      ["day", true],
      ["weeks", true],
      ["created_at", false],
    ]);
  });

  it("marks a column generated when it has a default or an identity", () => {
    expect(
      named("public", "visits")?.columns.map(({ name, generated }) => [
        name,
        generated,
      ]),
    ).toEqual([
      ["id", true],
      ["event_id", false],
      ["ip", false],
      ["seen_at", true],
    ]);
    expect(named("public", "events")?.columns[0]?.generated).toBe(true);
    expect(named("public", "events")?.columns[1]?.generated).toBe(false);
  });

  it("reads the columns of a view", () => {
    expect(named("public", "dated")?.columns.map(({ name }) => name)).toEqual([
      "id",
      "slug",
      "day",
    ]);
  });

  it("reads none from an empty database", async () => {
    const empty = pglite();
    await expect(readRelations(empty)).resolves.toEqual([]);
    await empty.close();
  });
});

describe("keyOf", () => {
  it("is the bare name of a visible relation and the qualified name of another", () => {
    expect(keyOf(named("public", "events")!)).toBe("events");
    expect(keyOf(named("audit", "events")!)).toBe("audit.events");
  });
});

describe("columnsOf", () => {
  it("keys each table by its qualified name, and by its bare name when visible", () => {
    const columns = columnsOf(relations);
    expect(columns.get("events")).toEqual(columns.get("public.events"));
    expect(columns.get("events")?.map(({ name }) => name)).toEqual([
      "id",
      "slug",
      "title",
      "day",
      "weeks",
      "created_at",
    ]);
    expect(columns.get("audit.events")).toEqual([
      { name: "id", nullable: false },
      { name: "note", nullable: true },
    ]);
    expect(columns.has("audit")).toBe(false);
  });

  it("leaves a view out", () => {
    expect(columnsOf(relations).has("dated")).toBe(false);
  });
});
