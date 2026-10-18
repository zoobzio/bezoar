import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

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
  it("produces the contract, the SQL, the migrations, and the seeds", async () => {
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
    ]);
    expect(output.enums.event_day).toEqual(["sunday", "monday", "tuesday"]);
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
