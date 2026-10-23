import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { makeBezoar } from "@bezoar/core";
import { pglite } from "@bezoar/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { apply } from "../src/apply";
import { InvalidRoleError, InvalidSourceError } from "../src/error";
import { generate } from "../src/generate";
import { readRoles, readSources } from "../src/read";
import { checkRoles } from "../src/roles";
import { validate } from "../src/validate";
import { discard, project } from "./helpers";

let root: string;

beforeEach(async () => {
  root = await project();
});

afterEach(async () => {
  await discard(root);
});

describe("readRoles", () => {
  it("reads each file as the grant of the role it is named for, in name order", async () => {
    const roles = await readRoles(root, "src/roles");
    expect(roles.map((r) => [r.role, r.path])).toEqual([
      ["admin", "src/roles/admin.sql"],
      ["web", "src/roles/web.sql"],
    ]);
    expect(roles[1]?.sql).toContain("GRANT SELECT ON events, dated TO web");
  });

  it("reads none from a directory that does not exist", async () => {
    await expect(readRoles(root, "elsewhere")).resolves.toEqual([]);
  });

  it("rejects a file whose name is not an identifier", async () => {
    await writeFile(join(root, "src/roles/web-app.sql"), "SELECT 1;");
    await expect(readRoles(root, "src/roles")).rejects.toThrow(
      InvalidRoleError,
    );
  });
});

describe("apply", () => {
  it("declares the roles before the migrations, so a migration can name one", async () => {
    await writeFile(
      join(root, "src/migrations/0004_policy.sql"),
      `ALTER TABLE events ENABLE ROW LEVEL SECURITY;
       CREATE POLICY dated ON events FOR SELECT TO web USING (day IS NOT NULL);
       CREATE POLICY all_of_them ON events TO admin USING (true) WITH CHECK (true);`,
    );
    const executor = pglite();
    try {
      await apply(executor, await readSources(root, validate({})));
      const { rows } = await executor.query(
        "SELECT rolname FROM pg_roles WHERE rolname IN ('web', 'admin') ORDER BY rolname",
        [],
      );
      expect(rows).toEqual([{ rolname: "admin" }, { rolname: "web" }]);
      const web = pglite(executor.client, { role: "web" });
      expect((await web.query("SELECT slug FROM events", [])).rows).toEqual([
        { slug: "worship" },
      ]);
      await executor.exec(
        "INSERT INTO events (slug, title) VALUES ('undated', 'Undated')",
      );
      expect(
        (await web.query("SELECT count(*)::int AS n FROM events", [])).rows,
      ).toEqual([{ n: 1 }]);
    } finally {
      await executor.close();
    }
  });

  it("names the file of a grant that fails", async () => {
    await writeFile(
      join(root, "src/roles/web.sql"),
      "GRANT SELECT ON nothing TO web;",
    );
    const executor = pglite();
    try {
      const error = apply(executor, await readSources(root, validate({})));
      await expect(error).rejects.toThrow(InvalidSourceError);
      await expect(error).rejects.toThrow(
        /src\/roles\/web\.sql failed: .*nothing/,
      );
    } finally {
      await executor.close();
    }
  });

  it("applies the migrations and the seeds alone without roles", async () => {
    await rm(join(root, "src/roles"), { recursive: true });
    const executor = pglite();
    try {
      await apply(executor, await readSources(root, validate({})));
      const { rows } = await executor.query(
        "SELECT count(*)::int AS n FROM pg_roles WHERE rolname IN ('web', 'admin')",
        [],
      );
      expect(rows).toEqual([{ n: 0 }]);
    } finally {
      await executor.close();
    }
  });
});

describe("checkRoles", () => {
  it("finds the queries each role may run", async () => {
    const executor = pglite();
    try {
      const sources = await readSources(root, validate({}));
      await apply(executor, sources);
      const roles = await checkRoles(executor, sources.queries, sources.roles);
      expect(roles.web).toEqual([
        "events.bySlug",
        "events.count",
        "events.list",
        "events.search",
      ]);
      expect(roles.admin).toEqual(sources.queries.map((query) => query.name));
    } finally {
      await executor.close();
    }
  });

  it("gives a role that may run nothing an empty list", async () => {
    await writeFile(join(root, "src/roles/guest.sql"), "-- nothing yet\n");
    const executor = pglite();
    try {
      const sources = await readSources(root, validate({}));
      await apply(executor, sources);
      const roles = await checkRoles(executor, sources.queries, sources.roles);
      expect(roles.guest).toEqual([]);
    } finally {
      await executor.close();
    }
  });

  it("executes nothing while it checks", async () => {
    const executor = pglite();
    try {
      const sources = await readSources(root, validate({}));
      await apply(executor, sources);
      const before = await executor.query(
        "SELECT count(*)::int AS n FROM events",
        [],
      );
      await checkRoles(executor, sources.queries, sources.roles);
      const after = await executor.query(
        "SELECT count(*)::int AS n FROM events",
        [],
      );
      expect(after.rows).toEqual(before.rows);
    } finally {
      await executor.close();
    }
  });
});

describe("the contract", () => {
  it("carries the roles, and a service scoped to one offers its queries alone", async () => {
    const { contract, files } = await generate({ outDir: ".output" }, root);
    expect(contract.roles).toEqual({
      admin: Object.keys(contract.queries).sort(),
      web: ["events.bySlug", "events.count", "events.list", "events.search"],
    });

    const outDir = join(root, ".output");
    await mkdir(outDir, { recursive: true });
    for (const file of files) {
      await writeFile(join(outDir, file.path), file.contents);
    }
    const built = await import(join(outDir, "index.mjs"));
    const { queries } = await import(join(outDir, "queries.mjs"));
    const executor = pglite();
    try {
      const db = makeBezoar(built.contract, {
        executor: pglite(executor.client, { role: "web" }),
        queries,
        role: "web",
      });
      const scoped = db as unknown as Record<string, object>;
      expect(Object.keys(scoped.events!).sort()).toEqual([
        "bySlug",
        "count",
        "list",
        "search",
      ]);
      expect("admin" in db).toBe(false);
    } finally {
      await executor.close();
    }
  });

  it("has no roles when the project has none", async () => {
    await rm(join(root, "src/roles"), { recursive: true });
    const { contract } = await generate({ outDir: ".output" }, root);
    expect(contract.roles).toEqual({});
  });
});
