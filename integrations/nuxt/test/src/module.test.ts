import type { NuxtBezoarConfig } from "../../src/config";

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface Template {
  filename: string;
  getContents: () => string;
}

const kit = vi.hoisted(() => ({
  addServerTemplate: vi.fn((template: Template) => template),
  addTypeTemplate: vi.fn((template: Template) => ({
    ...template,
    dst: `/build/${template.filename}`,
  })),
  addServerPlugin: vi.fn(),
  addServerImports: vi.fn(),
  createResolver: vi.fn(() => ({
    resolvePath: async (p: string) => `/module/.dist${p.slice(1)}.js`,
  })),
  directoryToURL: vi.fn((dir: string) => new URL(`file://${dir}/`)),
  tryResolveModule: vi.fn(
    async (_id: string, _url: URL): Promise<string | undefined> => undefined,
  ),
}));

vi.mock("@nuxt/kit", () => ({
  defineNuxtModule: (def: unknown) => def,
  ...kit,
}));

import module from "../../src/module";

interface Nuxt {
  options: {
    rootDir: string;
    runtimeConfig: { bezoar?: Record<string, unknown> };
    build: { transpile: unknown[] };
  };
}

const mod = module as unknown as {
  setup: (options: NuxtBezoarConfig, nuxt: Nuxt) => Promise<void>;
};

let root: string;
let nuxt: Nuxt;

/** Writes the four modules of a kit build into a directory. */
const build = async (directory: string) => {
  await mkdir(directory, { recursive: true });
  for (const entry of ["index", "queries", "migrations", "seeds"]) {
    await writeFile(join(directory, `${entry}.mjs`), "export {};\n");
  }
};

/** The virtual modules and the declaration the module added, by name. */
const written = (): Record<string, string> =>
  Object.fromEntries(
    [
      ...kit.addServerTemplate.mock.calls,
      ...kit.addTypeTemplate.mock.calls,
    ].map(([template]) => [template.filename, template.getContents()]),
  );

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "bezoar-nuxt-"));
  nuxt = {
    options: { rootDir: root, runtimeConfig: {}, build: { transpile: [] } },
  };
  vi.clearAllMocks();
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("bezoar module", () => {
  it("requires a build", async () => {
    await expect(mod.setup({} as NuxtBezoarConfig, nuxt)).rejects.toThrow(
      "`build` must name a kit build",
    );
  });

  it("adds the build of the app as a virtual module over a build at a path", async () => {
    await build(join(root, "db/.output"));
    await mod.setup({ build: "./db/.output" }, nuxt);
    const virtual = written()["#bezoar/build"];
    const exports = {
      index: "contract",
      queries: "queries",
      migrations: "migrations",
      seeds: "seeds",
    };
    for (const [entry, name] of Object.entries(exports)) {
      expect(virtual).toContain(
        `export { ${name} } from ${JSON.stringify(join(root, `db/.output/${entry}.mjs`))};`,
      );
    }
    expect(virtual).not.toContain("export *");
  });

  it("adds the service of the app as a virtual module over the virtual build", async () => {
    await build(join(root, "db/.output"));
    await mod.setup({ build: "./db/.output" }, nuxt);
    const service = written()["#bezoar/service"];
    expect(service).toContain(
      'import { contract, queries } from "#bezoar/build";',
    );
    expect(service).toContain(
      'import { defineService } from "/module/.dist/runtime/server/service.js";',
    );
    expect(service).toContain("defineService(contract, queries)");
    expect(service).not.toContain("type ");
  });

  it("declares the virtual service over the contract of the build", async () => {
    await build(join(root, "db/.output"));
    await mod.setup({ build: "./db/.output" }, nuxt);
    const declaration = written()["types/bezoar.d.ts"];
    expect(declaration).toContain('declare module "#bezoar/service" {');
    expect(declaration).toContain(
      `export type AppBezoarContract = typeof import(${JSON.stringify(join(root, "db/.output/index.mjs"))}).contract;`,
    );
    expect(declaration).toContain(
      'import("/module/.dist/runtime/server/service.js").Defined<AppBezoarContract>',
    );
    // An import declaration in an ambient module may not name a path.
    expect(declaration).not.toMatch(/^\s*import /m);
    expect(declaration).toContain("export const useBezoar:");
    expect(declaration).toContain("export type AppBezoar = ");
    expect(kit.addTypeTemplate).toHaveBeenCalledWith(expect.anything(), {
      nitro: true,
      nuxt: true,
    });
  });

  it("adopts a build named as a package", async () => {
    await build(join(root, "node_modules/@acme/database/.output"));
    kit.tryResolveModule.mockResolvedValueOnce(
      `file://${join(root, "node_modules/@acme/database/.output/index.mjs")}`,
    );
    await mod.setup({ build: "@acme/database" }, nuxt);
    expect(written()["#bezoar/build"]).toContain(
      join(root, "node_modules/@acme/database/.output/index.mjs"),
    );
  });

  it("rejects a build that cannot be found or is not a kit build", async () => {
    await expect(mod.setup({ build: "./nowhere" }, nuxt)).rejects.toThrow(
      "could not be found",
    );
    await mkdir(join(root, "empty"));
    await expect(mod.setup({ build: "./empty" }, nuxt)).rejects.toThrow(
      "is not a kit build; it has no index.mjs",
    );
  });

  it("sets the runtime config from the options, under what the app set", async () => {
    await build(join(root, ".output"));
    nuxt.options.runtimeConfig.bezoar = { url: "postgres://app" };
    await mod.setup(
      { build: "./.output", driver: "pglite", migrate: true },
      nuxt,
    );
    expect(nuxt.options.runtimeConfig.bezoar).toEqual({
      url: "postgres://app",
      dataDir: "",
      driver: "pglite",
      migrate: true,
      seed: false,
    });
  });

  it("transpiles the runtime of the module into the server bundle", async () => {
    await build(join(root, ".output"));
    nuxt.options.build.transpile.push("kept");
    await mod.setup({ build: "./.output" }, nuxt);
    expect(nuxt.options.build.transpile).toEqual([
      "kept",
      "/module/.dist/runtime/server",
    ]);
  });

  it("registers the plugin of the runtime and imports from the virtual service", async () => {
    await build(join(root, ".output"));
    await mod.setup({ build: "./.output" }, nuxt);
    expect(kit.addServerPlugin).toHaveBeenCalledWith(
      "/module/.dist/runtime/server/plugin.js",
    );
    const [imports] = kit.addServerImports.mock.calls[0] ?? [];
    const entries = imports as { name: string; from: string }[];
    expect(entries.every((entry) => entry.from === "#bezoar/service")).toBe(
      true,
    );
    expect(entries.map((entry) => entry.name)).toEqual([
      "useBezoar",
      "closeBezoar",
      "AppBezoar",
      "AppBezoarContract",
      "AppBezoarQuery",
      "AppBezoarArguments",
      "AppBezoarRow",
    ]);
  });
});
