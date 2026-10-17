import { describe, expect, it, vi } from "vitest";

import { migrations, seeds } from "../fixture";

const virtual = vi.hoisted(() => ({
  useBezoar: vi.fn(() => ({
    migrate: vi.fn(async () => []),
    seed: vi.fn(async () => {}),
  })),
  closeBezoar: vi.fn(async () => {}),
}));

vi.mock("#imports", () => ({
  useRuntimeConfig: () => ({
    bezoar: { migrate: false, seed: false },
  }),
  defineNitroPlugin: (plugin: unknown) => plugin,
}));
vi.mock("#bezoar/service", () => virtual);
vi.mock("#bezoar/build", async () => {
  const fixture = await import("../fixture");
  return { migrations: fixture.migrations, seeds: fixture.seeds };
});

import plugin from "../../src/runtime/server/plugin";
import { definePlugin } from "../../src/runtime/server/startup";

describe("plugin", () => {
  it("is the plugin of the runtime over the virtual service and build", async () => {
    expect(typeof plugin).toBe("function");
    const hooks: Record<string, () => unknown> = {};
    await plugin({
      hooks: {
        hook: (name, fn) => {
          hooks[name] = fn;
        },
      },
    });
    expect(virtual.useBezoar).toHaveBeenCalledOnce();
    await hooks.close?.();
    expect(virtual.closeBezoar).toHaveBeenCalledOnce();
    expect(migrations.length + seeds.length).toBeGreaterThan(0);
    expect(definePlugin).toBeTypeOf("function");
  });
});
