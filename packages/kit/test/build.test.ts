import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { build } from "../src/build";
import { emit } from "../src/emit";
import { generate } from "../src/generate";
import { writeOutput } from "../src/write";
import { discard, project } from "./helpers";

let root: string;

beforeEach(async () => {
  root = await project();
});

afterEach(async () => {
  await discard(root);
});

describe("generate", () => {
  it("produces the contract, the SQL, the migrations, the seeds, and the roles", async () => {
    const output = await generate({ outDir: ".output" }, root);
    expect(output.outDir).toBe(".output");
    expect(output.files.map((file) => file.path)).toEqual([
      "index.mjs",
      "index.d.mts",
      "queries.mjs",
      "queries.d.mts",
      "migrations.mjs",
      "migrations.d.mts",
      "seeds.mjs",
      "seeds.d.mts",
      "roles.mjs",
      "roles.d.mts",
    ]);
    expect(output.enums.event_day).toEqual(["sunday", "monday", "tuesday"]);
  });

  it("builds on a database with the extensions the config loads", async () => {
    await writeFile(
      join(root, "src/migrations/0004_search.sql"),
      "CREATE EXTENSION pg_trgm;\nCREATE INDEX events_slug_trgm ON events USING gin (slug gin_trgm_ops);\n",
    );
    await writeFile(
      join(root, "src/queries/events/similar.sql"),
      "SELECT id, slug FROM events WHERE slug % :term ORDER BY id",
    );
    await expect(generate({}, root)).rejects.toThrow(/pg_trgm/);
    const output = await generate(
      { database: { extensions: { pg_trgm } } },
      root,
    );
    expect(output.contract.queries["events.similar"]?.slots).toEqual([
      { name: "term", type: "text", nullable: false },
    ]);
  });

  it("builds on the client a function of the config makes", async () => {
    let client: PGlite | undefined;
    const output = await generate(
      {
        database: () => {
          client = new PGlite();
          return client;
        },
      },
      root,
    );
    expect(output.enums.event_day).toEqual(["sunday", "monday", "tuesday"]);
    expect(client?.closed).toBe(true);
  });
});

describe("emit", () => {
  it("writes each migration as data a runner can import", async () => {
    const output = await generate({}, root);
    const module = emit(output.sources, output.contract).find(
      (file) => file.path === "migrations.mjs",
    );
    expect(module?.contents).toContain(
      "export const migrations = Object.freeze([",
    );
    expect(module?.contents).toContain('"version": "0001"');
    expect(module?.contents).toContain('"checksum": "');
    expect(module?.contents).not.toContain('"path"');
  });
});

describe("build", () => {
  it("writes the output directory and a manifest", async () => {
    await build({ root });
    const files = await readdir(join(root, ".output"));
    expect(files.sort()).toEqual([
      ".bezoar.json",
      "index.d.mts",
      "index.mjs",
      "migrations.d.mts",
      "migrations.mjs",
      "queries.d.mts",
      "queries.mjs",
      "roles.d.mts",
      "roles.mjs",
      "seeds.d.mts",
      "seeds.mjs",
    ]);
  });

  it("imports as a module the runner can use", async () => {
    await build({ root });
    const { migrations } = await import(join(root, ".output/migrations.mjs"));
    expect(migrations.map((m: { version: string }) => m.version)).toEqual([
      "0001",
      "0002",
      "0003",
    ]);
    const { seeds } = await import(join(root, ".output/seeds.mjs"));
    expect(seeds[0].name).toBe("events");
    const { roles } = await import(join(root, ".output/roles.mjs"));
    expect(roles.map((r: { role: string }) => r.role)).toEqual([
      "admin",
      "web",
    ]);
    expect(roles[1].sql).toContain("GRANT SELECT ON events, dated TO web");
    const { contract } = await import(join(root, ".output/index.mjs"));
    expect(Object.keys(contract.roles)).toEqual(["admin", "web"]);
  });

  it("declares the roles of the contract as literal types", async () => {
    await build({ root });
    const declaration = await readFile(
      join(root, ".output/index.d.mts"),
      "utf8",
    );
    expect(declaration).toContain('readonly "roles": {');
    expect(declaration).toContain('readonly "web": readonly [');
  });

  it("removes a file the previous write produced and this one does not", async () => {
    const output = await generate({ outDir: ".output" }, root);
    await writeOutput(
      {
        ...output,
        files: [...output.files, { path: "stale.txt", contents: "" }],
      },
      root,
    );
    await writeFile(join(root, ".output/mine.txt"), "kept");
    await writeOutput(output, root);
    const files = await readdir(join(root, ".output"));
    expect(files).not.toContain("stale.txt");
    expect(files).toContain("mine.txt");
    expect(await readFile(join(root, ".output/mine.txt"), "utf8")).toBe("kept");
  });
});
