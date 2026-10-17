import type { BezoarRuntimeConfig } from "../../src/config";

import { describe, expect, it, vi } from "vitest";

const config = vi.hoisted((): { bezoar: BezoarRuntimeConfig } => ({
  bezoar: {
    url: "",
    dataDir: "",
    driver: "pglite",
    migrate: false,
    seed: false,
  },
}));

vi.mock("#imports", () => ({
  useRuntimeConfig: () => config,
  defineNitroPlugin: (plugin: unknown) => plugin,
}));

import { definePlugin } from "../../src/runtime/server/startup";
import type { contract } from "../fixture";

import { migrations, seeds } from "../fixture";

const service = {
  migrate: vi.fn(async () => ["0001"]),
  seed: vi.fn(async () => {}),
};
const closeBezoar = vi.fn(async () => {});

const start = async () => {
  const plugin = definePlugin<typeof contract>({
    useBezoar: () => service as never,
    closeBezoar,
    migrations,
    seeds,
  });
  const hooks: Record<string, () => unknown> = {};
  await plugin({
    hooks: {
      hook: (name, fn) => {
        hooks[name] = fn;
      },
    },
  });
  return hooks;
};

describe("definePlugin", () => {
  it("makes the service and closes it when the server stops", async () => {
    const hooks = await start();
    expect(service.migrate).not.toHaveBeenCalled();
    expect(service.seed).not.toHaveBeenCalled();
    await hooks.close?.();
    expect(closeBezoar).toHaveBeenCalledOnce();
  });

  it("applies the migrations and runs the seeds when the config asks", async () => {
    config.bezoar = { ...config.bezoar, migrate: true, seed: true };
    await start();
    expect(service.migrate).toHaveBeenCalledWith(migrations);
    expect(service.seed).toHaveBeenCalledWith(seeds);
  });
});
