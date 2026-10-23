import type { BezoarRuntimeConfig } from "../../src/config";

import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

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
}));

import type { Definition } from "bezoar";

import { defineService } from "../../src/runtime/server/service";
import { contract, migrations, queries, roles, seeds } from "../fixture";

const { useBezoar, closeBezoar } = defineService(contract, queries);

afterEach(async () => {
  await closeBezoar();
  config.bezoar = {
    url: "",
    dataDir: "",
    driver: "pglite",
    migrate: false,
    seed: false,
    roles: false,
    role: "",
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

describe("defineService with a role", () => {
  const scoped = {
    ...contract,
    roles: { web: ["events.count"] },
  } as const satisfies Definition;

  it("scopes the service to the role of the runtime config, over the owner's database", async () => {
    config.bezoar = { ...config.bezoar, role: "web" };
    const { useBezoar, useBezoarOwner, closeBezoar } = defineService<
      typeof scoped,
      "web"
    >(scoped, queries);
    try {
      const owner = useBezoarOwner();
      await owner.roles.declare(roles);
      await owner.migrate(migrations);
      await owner.roles(roles);
      await owner.seed(seeds);

      const db = useBezoar();
      expect(db).not.toBe(owner);
      expect(db.config.role).toBe("web");
      expect(await db.events.count.first()).toEqual({ total: 1 });
      expectTypeOf(db).not.toHaveProperty("events.list");
      expect("list" in db.events).toBe(false);
      const { rows } = await db.config.executor.query(
        "SELECT current_user AS who",
        [],
      );
      expect(rows).toEqual([{ who: "web" }]);
      expect(useBezoar()).toBe(db);
    } finally {
      await closeBezoar();
    }
  });

  it("is the owner's service without a role", () => {
    const { useBezoar, useBezoarOwner, closeBezoar } = defineService(
      scoped,
      queries,
    );
    expect(useBezoar()).toBe(useBezoarOwner());
    return closeBezoar();
  });

  it("refuses a role the contract does not have", () => {
    config.bezoar = { ...config.bezoar, role: "guest" };
    const { useBezoar, closeBezoar } = defineService(scoped, queries);
    expect(() => useBezoar()).toThrow('no role "guest"');
    return closeBezoar();
  });
});
