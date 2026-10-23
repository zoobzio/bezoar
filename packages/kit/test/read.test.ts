import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readMigrations, readSeeds, readSources } from "../src/read";
import { discard, project } from "./helpers";

let root: string;

beforeEach(async () => {
  root = await project();
});

afterEach(async () => {
  await discard(root);
});

describe("readMigrations", () => {
  it("reads each file with its version and name, in file name order", async () => {
    const migrations = await readMigrations(root, "src/migrations");
    expect(migrations.map((m) => [m.version, m.name, m.path])).toEqual([
      ["0001", "events", "src/migrations/0001_events.sql"],
      ["0002", "staff", "src/migrations/0002_staff.sql"],
      ["0003", "visits", "src/migrations/0003_visits.sql"],
    ]);
    expect(migrations[0]?.sql).toContain("CREATE TYPE event_day");
  });

  it("takes a file name of another form as both the version and the name", async () => {
    await writeFile(
      join(root, "src/migrations/20261016-staff.sql"),
      "SELECT 1;",
    );
    const migrations = await readMigrations(root, "src/migrations");
    expect(migrations.map((m) => [m.version, m.name])).toEqual([
      ["0001", "events"],
      ["0002", "staff"],
      ["0003", "visits"],
      ["20261016-staff", "20261016-staff"],
    ]);
  });

  it("checksums the text of each file", async () => {
    const [first] = await readMigrations(root, "src/migrations");
    expect(first?.checksum).toMatch(/^[0-9a-f]{64}$/);
    await writeFile(join(root, "src/migrations/0001_events.sql"), "SELECT 1;");
    const [changed] = await readMigrations(root, "src/migrations");
    expect(changed?.checksum).not.toBe(first?.checksum);
  });

  it("reads none from a directory that does not exist", async () => {
    await expect(readMigrations(root, "elsewhere")).resolves.toEqual([]);
  });

  it("reads only .sql files", async () => {
    await writeFile(join(root, "src/migrations/notes.md"), "# notes");
    const migrations = await readMigrations(root, "src/migrations");
    expect(migrations).toHaveLength(3);
  });
});

describe("readSeeds", () => {
  it("reads each file with its name", async () => {
    const seeds = await readSeeds(root, "src/seeds");
    expect(seeds.map((s) => [s.name, s.path])).toEqual([
      ["events", "src/seeds/events.sql"],
    ]);
    expect(seeds[0]?.sql).toContain("INSERT INTO events");
  });
});

describe("readSources", () => {
  it("reads the migrations and the seeds of the settings", async () => {
    const sources = await readSources(root, {
      migrations: "src/migrations",
      seeds: "src/seeds",
      queries: "src/queries",
      roles: "src/roles",
      outDir: ".output",
    });
    expect(sources.migrations).toHaveLength(3);
    expect(sources.seeds).toHaveLength(1);
    expect(sources.queries).toHaveLength(8);
  });
});
