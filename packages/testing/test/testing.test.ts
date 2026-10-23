import type { Grant, Migration, Seed } from "@bezoar/core";
import type { Definition } from "@bezoar/schema";

import {
  MigrationError,
  QueryError,
  RoleError,
  UnknownRoleError,
} from "@bezoar/core";
import { describe, expect, it, vi } from "vitest";

import { makeTestBezoar } from "../src/testing";
import { contract, migrations, queries, seeds } from "./fixture";

describe("makeTestBezoar", () => {
  it("makes a service with the migrations applied and the seeds run", async () => {
    const db = await makeTestBezoar(contract, {
      queries,
      migrations,
      seeds,
    });
    expect(await db.events.list({ day: "sunday" })).toEqual([
      { id: 1, slug: "worship" },
    ]);
    expect(await db.events.count.first()).toEqual({ total: 1 });
    await db.close();
  });

  it("makes a service without seeds", async () => {
    const db = await makeTestBezoar(contract, { queries, migrations });
    expect(await db.events.count.first()).toEqual({ total: 0 });
    await db.close();
  });

  it("makes its own database for each call", async () => {
    const first = await makeTestBezoar(contract, {
      queries,
      migrations,
      seeds,
    });
    const second = await makeTestBezoar(contract, { queries, migrations });
    expect(await first.events.count.first()).toEqual({ total: 1 });
    expect(await second.events.count.first()).toEqual({ total: 0 });
    await first.close();
    await second.close();
  });

  it("passes the options to the service", async () => {
    const onQuery = vi.fn();
    const db = await makeTestBezoar(
      contract,
      { queries, migrations },
      { onQuery },
    );
    await db.events.count.first();
    expect(onQuery).toHaveBeenCalledOnce();
    await db.close();
  });

  it("closes the database with await using", async () => {
    let kept: Awaited<ReturnType<typeof makeTestBezoar<typeof contract>>>;
    {
      await using db = await makeTestBezoar(contract, {
        queries,
        migrations,
      });
      kept = db;
      expect(await db.events.count.first()).toEqual({ total: 0 });
    }
    await expect(kept.events.count.first()).rejects.toThrow(QueryError);
  });

  it("closes the database and throws when a migration fails", async () => {
    const failing = [
      {
        version: "0001",
        name: "bad",
        sql: "CREATE TABLE t (id nosuchtype);",
        checksum: "x",
      },
    ];
    await expect(
      makeTestBezoar(contract, { queries, migrations: failing }),
    ).rejects.toThrow(MigrationError);
  });
});

describe("makeTestBezoar with roles", () => {
  const scoped = {
    ...contract,
    roles: { web: ["events.list", "events.count"], office: ["events.count"] },
  } as const satisfies Definition;
  const roles: Grant[] = [
    { role: "web", sql: "GRANT SELECT ON events TO web;" },
    { role: "office", sql: "" },
  ];
  const policy: Migration[] = [
    ...migrations,
    {
      version: "0002",
      name: "policy",
      checksum: "b",
      sql: `ALTER TABLE events ENABLE ROW LEVEL SECURITY;
            CREATE POLICY sundays ON events FOR SELECT TO web USING (day = 'sunday');`,
    },
  ];
  const seeded: Seed[] = [
    {
      name: "events",
      sql: `INSERT INTO events (slug, day) VALUES ('worship', 'sunday'), ('study', 'monday') ON CONFLICT DO NOTHING;`,
    },
  ];

  it("declares the roles before the migrations and applies the grants after", async () => {
    await using db = await makeTestBezoar(scoped, {
      queries,
      migrations: policy,
      seeds: seeded,
      roles,
    });
    expect(await db.events.count.first()).toEqual({ total: 2 });
    const { rows } = await db.config.executor.query(
      "SELECT has_table_privilege('web', 'events', 'SELECT') AS can",
      [],
    );
    expect(rows).toEqual([{ can: true }]);
  });

  it("scopes the service to a role, over the database the owner set up", async () => {
    await using db = await makeTestBezoar(scoped, {
      queries,
      migrations: policy,
      seeds: seeded,
      roles,
      role: "web",
    });
    expect(db.config.role).toBe("web");
    expect(await db.events.count.first()).toEqual({ total: 1 });
    expect(await db.events.list({ day: "monday" })).toEqual([]);
  });

  it("throws when the contract has no such role", async () => {
    await expect(
      makeTestBezoar(scoped, {
        queries,
        migrations,
        roles,
        // @ts-expect-error The contract has no such role.
        role: "guest",
      }),
    ).rejects.toThrow(UnknownRoleError);
  });

  it("closes the database and throws when a grant fails", async () => {
    await expect(
      makeTestBezoar(scoped, {
        queries,
        migrations,
        roles: [{ role: "web", sql: "GRANT SELECT ON nothing TO web;" }],
      }),
    ).rejects.toThrow(RoleError);
  });
});
