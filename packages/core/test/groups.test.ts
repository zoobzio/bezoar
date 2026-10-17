import type { Definition, Statement } from "@bezoar/schema";

import { collect, keys } from "objectively";
import { describe, expect, it } from "vitest";

import { AmbiguousQueryError, ReservedQueryError } from "../src/error";
import { defineGroups } from "../src/groups";

/** A statement with no slot and no column, for a name alone. */
const statement: Statement = { slots: [], columns: [] };

/** A definition whose queries are the given names. */
const named = <N extends string>(...names: N[]) =>
  ({
    enums: {},
    queries: collect(names, (name) => [name, statement]),
  }) satisfies Definition;

/** Makes a function that resolves to the name of its query. */
const method = (query: string) => async () => query;
const reserved = new Set(["migrate"]);

/** The groups of a definition, with `method` for each query. */
const groupsOf = <D extends Definition>(definition: D) =>
  defineGroups<D>(keys(definition.queries), reserved, method);

describe("defineGroups", () => {
  it("puts a function for each query under its group", async () => {
    const groups = groupsOf(
      named("events.list", "events.bySlug", "sermons.recent"),
    );
    expect(Object.keys(groups).sort()).toEqual(["events", "sermons"]);
    expect(await groups.events.list()).toBe("events.list");
    expect(await groups.sermons.recent()).toBe("sermons.recent");
  });

  it("nests a level for each dot", async () => {
    const groups = groupsOf(named("admin.events.purge"));
    expect(await groups.admin.events.purge()).toBe("admin.events.purge");
  });

  it("puts a query with no group at the root", async () => {
    const groups = groupsOf(named("health"));
    expect(await groups.health()).toBe("health");
  });

  it("rejects a top-level name the service reserves", () => {
    expect(() => groupsOf(named("migrate.all"))).toThrow(ReservedQueryError);
    expect(() => groupsOf(named("migrate"))).toThrow(ReservedQueryError);
  });

  it("rejects a name that is both a query and a group", () => {
    expect(() => groupsOf(named("events", "events.list"))).toThrow(
      AmbiguousQueryError,
    );
    expect(() => groupsOf(named("events.list", "events"))).toThrow(
      AmbiguousQueryError,
    );
  });
});
