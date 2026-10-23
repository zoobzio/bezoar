import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { defineConfig } from "../src/config";
import {
  InvalidConfigError,
  MalformedConfigError,
  MissingConfigError,
} from "../src/error";
import { loadConfig } from "../src/load";
import { validate } from "../src/validate";
import { discard, project } from "./helpers";

let root: string;

beforeEach(async () => {
  root = await project();
});

afterEach(async () => {
  await discard(root);
});

describe("defineConfig", () => {
  it("returns the config it is given", () => {
    const config = { outDir: ".output" };
    expect(defineConfig(config)).toBe(config);
  });
});

describe("loadConfig", () => {
  it("loads the default export of a TypeScript config", async () => {
    await expect(loadConfig(join(root, "bezoar.config.ts"))).resolves.toEqual({
      outDir: ".output",
    });
  });

  it("throws when there is no file", async () => {
    await expect(loadConfig(join(root, "missing.config.ts"))).rejects.toThrow(
      MissingConfigError,
    );
  });

  it("throws when the default export is not a record", async () => {
    await writeFile(join(root, "bad.config.ts"), "export default 42;\n");
    await expect(loadConfig(join(root, "bad.config.ts"))).rejects.toThrow(
      MalformedConfigError,
    );
  });
});

describe("validate", () => {
  it("applies the defaults", () => {
    expect(validate({})).toEqual({
      migrations: "src/migrations",
      seeds: "src/seeds",
      queries: "src/queries",
      roles: "src/roles",
      outDir: "bezoar",
    });
  });

  it("normalizes the paths it is given", () => {
    expect(
      validate({ migrations: "./db/migrations/", outDir: ".output" }),
    ).toEqual({
      migrations: "db/migrations",
      seeds: "src/seeds",
      queries: "src/queries",
      roles: "src/roles",
      outDir: ".output",
    });
  });

  it("rejects a directory outside the project root with every issue", () => {
    expect(() => validate({ migrations: "../up", outDir: "/abs" })).toThrow(
      InvalidConfigError,
    );
    try {
      validate({ migrations: "../up", outDir: "/abs" });
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidConfigError);
      if (error instanceof InvalidConfigError) {
        expect(error.issues).toHaveLength(2);
      }
    }
  });
});
