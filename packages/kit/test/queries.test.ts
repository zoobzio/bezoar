import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { InvalidQueryError } from "../src/error";
import { readQueries } from "../src/queries";
import { discard, project } from "./helpers";

let root: string;

beforeEach(async () => {
  root = await project();
});

afterEach(async () => {
  await discard(root);
});

/** Writes a query file into the project and reads the directory. */
const read = async (file: string, text: string) => {
  const path = join(root, "src/queries", file);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, text);
  return readQueries(root, "src/queries");
};

describe("readQueries", () => {
  it("reads each file as a query named for its path", async () => {
    const queries = await readQueries(root, "src/queries");
    expect(queries.map((query) => [query.name, query.path])).toEqual([
      ["admin.staff.leaders", "src/queries/admin/staff/leaders.sql"],
      ["events.bySlug", "src/queries/events/bySlug.sql"],
      ["events.count", "src/queries/events/count.sql"],
      ["events.insert", "src/queries/events/insert.sql"],
      ["events.list", "src/queries/events/list.sql"],
      ["events.touch", "src/queries/events/touch.sql"],
    ]);
  });

  it("rewrites the slots, keeps a comment, and drops the trailing semicolon", async () => {
    const queries = await readQueries(root, "src/queries");
    const list = queries.find((query) => query.name === "events.list");
    expect(list?.sql).toBe(
      "-- The events of a day, in order.\n\nSELECT id, slug, title, day, weeks, created_at\nFROM events\nWHERE day = $1\nORDER BY id",
    );
    expect(list?.slots).toEqual(["day"]);
  });

  it("names a file at the root for itself", async () => {
    const queries = await read("health.sql", "SELECT 1 AS ok");
    expect(queries.map((query) => query.name)).toContain("health");
  });

  it("reads none from a directory that does not exist", async () => {
    await expect(readQueries(root, "elsewhere")).resolves.toEqual([]);
  });

  it("rejects a path that is not identifiers", async () => {
    await expect(read("by-slug.sql", "SELECT 1")).rejects.toThrow(
      /by-slug\.sql has "by-slug" in its path/,
    );
    await expect(read("admin-only/a.sql", "SELECT 1")).rejects.toThrow(
      /admin-only\/a\.sql has "admin-only" in its path/,
    );
  });

  it("rejects a file without SQL", async () => {
    await expect(read("bad.sql", "\n-- nothing here\n")).rejects.toThrow(
      /bad\.sql has no SQL/,
    );
  });

  it("rejects a query that is also a group", async () => {
    await expect(read("events.sql", "SELECT 1")).rejects.toThrow(
      /events\/bySlug\.sql is in the group events, which is also the name of a query/,
    );
  });

  it("rejects a slot the lexer rejects, with the file", async () => {
    const error = read("bad.sql", "SELECT $1");
    await expect(error).rejects.toThrow(InvalidQueryError);
    await expect(error).rejects.toThrow(/bad\.sql uses a \$n parameter/);
  });
});
