import type { BezoarRuntimeConfig } from "../../src/config";

import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

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
}));

import { defineService } from "../../src/runtime/server/service";
import { contract, migrations, queries } from "../fixture";

const { useBezoar, closeBezoar } = defineService(contract, queries);

afterEach(async () => {
  await closeBezoar();
  config.bezoar = {
    url: "",
    dataDir: "",
    driver: "pglite",
    migrate: false,
    seed: false,
  };
});

describe("defineService", () => {
  it("makes a service over the contract with the pglite driver", async () => {
    const db = useBezoar();
    await db.migrate(migrations);
    expect(await db.events.count.first()).toEqual({ total: 0 });
  });

  it("types the service by the contract", () => {
    const db = useBezoar();
    expectTypeOf(db.events.list).parameter(0).toEqualTypeOf<{
      day: "sunday" | "monday";
    }>();
  });

  it("returns the same service on every call", () => {
    expect(useBezoar()).toBe(useBezoar());
  });

  it("connects again after close", async () => {
    const before = useBezoar();
    await closeBezoar();
    const after = useBezoar();
    expect(after).not.toBe(before);
    await after.migrate(migrations);
    expect(await after.events.count.first()).toEqual({ total: 0 });
  });

  it("needs a connection string for the pg driver", () => {
    config.bezoar = { ...config.bezoar, driver: "pg" };
    expect(() => useBezoar()).toThrow("no connection string");
  });
});
