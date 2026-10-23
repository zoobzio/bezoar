import type { BezoarRuntimeConfig } from "../../src/config";

import { describe, expect, it, vi } from "vitest";

const config = vi.hoisted((): { bezoar: BezoarRuntimeConfig } => ({
  bezoar: {
    url: "",
    dataDir: "",
    driver: "pglite",
    migrate: false,
    seed: false,
    roles: false,
    role: "",
  },
}));

vi.mock("#imports", () => ({
  useRuntimeConfig: () => config,
  defineNitroPlugin: (plugin: unknown) => plugin,
}));

import { definePlugin } from "../../src/runtime/server/startup";
import type { contract } from "../fixture";

import { migrations, roles, seeds } from "../fixture";

const declare = vi.fn(async () => {});
const service = {
  migrate: vi.fn(async () => ["0001"]),
  seed: vi.fn(async () => {}),
  roles: Object.assign(
    vi.fn(async () => {}),
    { declare },
  ),
};
const scoped = { scoped: true };
const useBezoar = vi.fn(() => scoped as never);
const closeBezoar = vi.fn(async () => {});

const start = async () => {
  const plugin = definePlugin<typeof contract>({
    useBezoar,
    useBezoarOwner: () => service as never,
    closeBezoar,
    migrations,
    seeds,
    roles,
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
    expect(useBezoar).toHaveBeenCalledOnce();
    expect(service.migrate).not.toHaveBeenCalled();
    expect(service.seed).not.toHaveBeenCalled();
    expect(service.roles).not.toHaveBeenCalled();
    expect(declare).not.toHaveBeenCalled();
    await hooks.close?.();
    expect(closeBezoar).toHaveBeenCalledOnce();
  });

  it("applies the migrations and runs the seeds when the config asks", async () => {
    config.bezoar = { ...config.bezoar, migrate: true, seed: true };
    await start();
    expect(service.migrate).toHaveBeenCalledWith(migrations);
    expect(service.seed).toHaveBeenCalledWith(seeds);
    expect(service.roles).not.toHaveBeenCalled();
  });

  it("declares the roles before the migrations and applies the grants after, before the seeds", async () => {
    config.bezoar = {
      ...config.bezoar,
      migrate: true,
      seed: true,
      roles: true,
    };
    const order: string[] = [];
    declare.mockImplementationOnce(async () => {
      order.push("declare");
    });
    service.migrate.mockImplementationOnce(async () => {
      order.push("migrate");
      return [];
    });
    service.roles.mockImplementationOnce(async () => {
      order.push("roles");
    });
    service.seed.mockImplementationOnce(async () => {
      order.push("seed");
    });
    await start();
    expect(order).toEqual(["declare", "migrate", "roles", "seed"]);
    expect(declare).toHaveBeenCalledWith(roles);
    expect(service.roles).toHaveBeenCalledWith(roles);
  });
});
