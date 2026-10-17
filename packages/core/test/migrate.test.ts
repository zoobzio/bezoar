import { describe, expect, it } from "vitest";

import type { Migration } from "../src/types";

import { MigrationDriftError, MigrationError, SeedError } from "../src/error";
import { LOCK, TABLE } from "../src/constant";
import { migrate } from "../src/migrate";
import { seed } from "../src/seed";
import { fake } from "./fixture";

const migrations: Migration[] = [
  {
    version: "0001",
    name: "events",
    sql: "CREATE TABLE events ()",
    checksum: "a",
  },
  {
    version: "0002",
    name: "staff",
    sql: "CREATE TABLE staff ()",
    checksum: "b",
  },
];

/** A fake whose tracking table holds the given rows. */
const database = (applied: { version: string; checksum: string }[]) =>
  fake((sql) =>
    sql.startsWith("SELECT version")
      ? { rows: applied, count: applied.length }
      : { rows: [], count: 0 },
  );

describe("migrate", () => {
  it("locks, makes the table, and applies every migration of an empty database", async () => {
    const executor = database([]);
    await expect(migrate(executor, migrations)).resolves.toEqual([
      "0001",
      "0002",
    ]);

    const [lock, create, read, first, record, second] = executor.calls;
    expect(lock).toMatchObject({ kind: "query", params: [LOCK], depth: 1 });
    expect(lock?.sql).toContain("pg_advisory_xact_lock");
    expect(create?.sql).toContain(`CREATE TABLE IF NOT EXISTS ${TABLE}`);
    expect(read?.sql).toContain(`FROM ${TABLE}`);
    expect(first).toMatchObject({
      kind: "exec",
      sql: "CREATE TABLE events ()",
    });
    expect(record).toMatchObject({ params: ["0001", "events", "a"] });
    expect(second).toMatchObject({
      kind: "exec",
      sql: "CREATE TABLE staff ()",
    });
    expect(executor.ends).toEqual(["commit"]);
  });

  it("applies only what the database lacks", async () => {
    const executor = database([{ version: "0001", checksum: "a" }]);
    await expect(migrate(executor, migrations)).resolves.toEqual(["0002"]);
    const applied = executor.calls.filter((call) => call.kind === "exec");
    expect(applied.map((call) => call.sql)).toEqual([
      expect.stringContaining("CREATE TABLE IF NOT EXISTS"),
      "CREATE TABLE staff ()",
    ]);
  });

  it("applies nothing when the database is current", async () => {
    const executor = database([
      { version: "0001", checksum: "a" },
      { version: "0002", checksum: "b" },
    ]);
    await expect(migrate(executor, migrations)).resolves.toEqual([]);
  });

  it("refuses an applied migration whose checksum changed", async () => {
    const executor = database([{ version: "0001", checksum: "changed" }]);
    await expect(migrate(executor, migrations)).rejects.toThrow(
      MigrationDriftError,
    );
    expect(
      executor.calls.some((call) => call.sql === "CREATE TABLE staff ()"),
    ).toBe(false);
    expect(executor.ends).toEqual(["rollback"]);
  });

  it("refuses an applied migration the list does not have", async () => {
    const executor = database([{ version: "0000", checksum: "z" }]);
    await expect(migrate(executor, migrations)).rejects.toThrow(
      MigrationDriftError,
    );
  });

  it("rolls the run back when a migration fails", async () => {
    const executor = database([]);
    const failing = [
      migrations[0]!,
      { version: "0002", name: "bad", sql: "FAIL", checksum: "c" },
    ];
    await expect(migrate(executor, failing)).rejects.toThrow(MigrationError);
    expect(executor.ends).toEqual(["rollback"]);
  });
});

describe("seed", () => {
  it("runs each seed in order inside one transaction", async () => {
    const executor = fake();
    await seed(executor, [
      { name: "events", sql: "INSERT INTO events" },
      { name: "staff", sql: "INSERT INTO staff" },
    ]);
    expect(executor.calls.map((call) => [call.sql, call.depth])).toEqual([
      ["INSERT INTO events", 1],
      ["INSERT INTO staff", 1],
    ]);
    expect(executor.ends).toEqual(["commit"]);
  });

  it("rolls the run back when a seed fails", async () => {
    const executor = fake();
    await expect(
      seed(executor, [{ name: "bad", sql: "FAIL" }]),
    ).rejects.toThrow(SeedError);
    expect(executor.ends).toEqual(["rollback"]);
  });
});
