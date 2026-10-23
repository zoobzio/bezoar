import { describe, expect, it } from "vitest";

import type { Grant } from "../src/types";

import { ROLES_LOCK } from "../src/constant";
import { RoleError } from "../src/error";
import { declareRoles, roles } from "../src/roles";
import { fake } from "./fixture";

const grants: Grant[] = [
  { role: "web", sql: "GRANT SELECT ON events TO web" },
  { role: "admin", sql: "GRANT ALL ON events TO admin" },
];

/**
 * A fake whose cluster holds the given roles and whose database has the
 * given schemas.
 */
const cluster = (existing: string[], schemas = ["public"]) =>
  fake((sql, params) => {
    if (sql.startsWith("SELECT 1 FROM pg_roles")) {
      const found = existing.includes(String(params[0]));
      return { rows: found ? [{ "?column?": 1 }] : [], count: found ? 1 : 0 };
    }
    if (sql.startsWith("SELECT nspname")) {
      return {
        rows: schemas.map((nspname) => ({ nspname })),
        count: schemas.length,
      };
    }
    return { rows: [], count: 0 };
  });

describe("declareRoles", () => {
  it("makes each role the cluster lacks, as a role that cannot log in", async () => {
    const executor = cluster(["admin"]);
    await declareRoles(executor, grants);
    const made = executor.calls.filter((call) => call.kind === "exec");
    expect(made.map((call) => call.sql)).toEqual(['CREATE ROLE "web" NOLOGIN']);
    expect(made[0]?.depth).toBe(1);
    expect(executor.ends).toEqual(["commit"]);
  });

  it("issues nothing when every role exists", async () => {
    const executor = cluster(["web", "admin"]);
    await declareRoles(executor, grants);
    expect(executor.calls.filter((call) => call.kind === "exec")).toEqual([]);
  });

  it("quotes a role name", async () => {
    const executor = cluster([]);
    await declareRoles(executor, [{ role: 'odd"one', sql: "" }]);
    expect(executor.calls.at(-1)?.sql).toBe('CREATE ROLE "odd""one" NOLOGIN');
  });
});

describe("roles", () => {
  it("locks, makes the roles, revokes in each schema, and applies each grant", async () => {
    const executor = cluster([], ["public", "app"]);
    await roles(executor, grants);

    const [lock] = executor.calls;
    expect(lock).toMatchObject({
      kind: "query",
      params: [ROLES_LOCK],
      depth: 1,
    });
    expect(lock?.sql).toContain("pg_advisory_xact_lock");

    const ran = executor.calls
      .filter((call) => call.kind === "exec")
      .map((call) => call.sql);
    expect(ran).toEqual([
      'CREATE ROLE "web" NOLOGIN',
      'CREATE ROLE "admin" NOLOGIN',
      expect.stringContaining('ON ALL TABLES IN SCHEMA "public" FROM "web"'),
      expect.stringContaining('ON ALL TABLES IN SCHEMA "app" FROM "web"'),
      "GRANT SELECT ON events TO web",
      expect.stringContaining('ON ALL TABLES IN SCHEMA "public" FROM "admin"'),
      expect.stringContaining('ON ALL TABLES IN SCHEMA "app" FROM "admin"'),
      "GRANT ALL ON events TO admin",
    ]);
    expect(ran[2]).toContain('ON ALL SEQUENCES IN SCHEMA "public" FROM "web"');
    expect(ran[2]).toContain('ON ALL ROUTINES IN SCHEMA "public" FROM "web"');
    expect(ran[2]).toContain('ON SCHEMA "public" FROM "web"');
    expect(executor.ends).toEqual(["commit"]);
  });

  it("rolls back and names the role when a grant fails", async () => {
    const executor = cluster(["web", "admin"]);
    const error = await roles(executor, [
      grants[0]!,
      { role: "admin", sql: "FAIL" },
    ]).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(RoleError);
    expect((error as RoleError).role).toBe("admin");
    expect((error as RoleError).cause).toBeInstanceOf(Error);
    expect(executor.ends).toEqual(["rollback"]);
  });
});
