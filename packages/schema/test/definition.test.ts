import { describe, expect, it } from "vitest";

import { definition as schema } from "../src/definition";
import { altered, definition, listOf, queriesOf, tablesOf } from "./fixture";

/** A definition with no enum, no query, and no table. */
const empty = { enums: {}, queries: {}, tables: {} };

/** The paths of every issue of a value, as dotted strings. */
const paths = (value: unknown): string[] => {
  const result = schema.safeParse(value);
  return result.success
    ? []
    : result.error.issues.map((issue) => issue.path.map(String).join("."));
};

describe("definition", () => {
  it("accepts the fixture", () => {
    expect(schema.safeParse(definition).success).toBe(true);
  });

  it("accepts a definition with no enum, no query, and no table", () => {
    expect(schema.safeParse(empty).success).toBe(true);
  });

  it("rejects a value that is not an object", () => {
    expect(schema.safeParse([]).success).toBe(false);
    expect(schema.safeParse(null).success).toBe(false);
  });

  it("rejects an unknown or missing member", () => {
    const stray = schema.safeParse({ ...empty, views: {} });
    expect(stray.success).toBe(false);
    if (!stray.success) {
      expect(stray.error.issues[0]?.code).toBe("unrecognized_keys");
    }
    expect(paths({ enums: {} })).toEqual(["queries", "tables"]);
  });

  it("rejects an enum that is not a list of distinct labels", () => {
    expect(paths({ ...empty, enums: { mood: ["glad", "glad"] } })).toEqual([
      "enums.mood.1",
    ]);
    expect(paths({ ...empty, enums: { mood: "glad" } })).toEqual([
      "enums.mood",
    ]);
    expect(paths({ ...empty, enums: { mood: [""] } })).toEqual([
      "enums.mood.0",
    ]);
  });

  it("rejects an enum name that is not an identifier or that a scalar uses", () => {
    expect(paths({ ...empty, enums: { "my-mood": [] } })).toEqual([
      "enums.my-mood",
    ]);
    expect(paths({ ...empty, enums: { text: ["a"] } })).toEqual(["enums.text"]);
  });

  it("accepts roles that list queries of the contract", () => {
    expect(
      schema.safeParse({
        ...definition,
        roles: { web: ["events.list"], admin: [] },
      }).success,
    ).toBe(true);
  });

  it("rejects a role that lists a query the contract lacks, or one twice", () => {
    expect(paths({ ...definition, roles: { web: ["events.purge"] } })).toEqual([
      "roles.web.0",
    ]);
    expect(
      paths({ ...definition, roles: { web: ["events.list", "events.list"] } }),
    ).toEqual(["roles.web.1"]);
  });

  it("rejects a role name that is not an identifier", () => {
    expect(paths({ ...empty, roles: { "web-app": [] } })).toEqual([
      "roles.web-app",
    ]);
  });

  it("rejects a query name that is not dotted identifiers", () => {
    const copy = altered((copy) => {
      queriesOf(copy)["events.list-all"] = listOf(copy);
    });
    expect(paths(copy)).toEqual(["queries.events.list-all"]);
  });

  it("rejects a statement with an extra or a missing member", () => {
    expect(
      paths(
        altered((copy) => {
          listOf(copy).mode = "some";
        }),
      ),
    ).toEqual(["queries.events.list"]);
    expect(
      paths(
        altered((copy) => {
          delete listOf(copy).columns;
        }),
      ),
    ).toEqual(["queries.events.list.columns"]);
  });

  it("rejects a field that is not complete", () => {
    expect(
      paths(
        altered((copy) => {
          listOf(copy).columns = [{ name: "x", type: "int4" }];
        }),
      ),
    ).toEqual(["queries.events.list.columns.0.nullable"]);
    expect(
      paths(
        altered((copy) => {
          listOf(copy).columns = [{ name: "", type: "int4", nullable: true }];
        }),
      ),
    ).toEqual(["queries.events.list.columns.0.name"]);
  });

  it("rejects a type the contract does not know", () => {
    expect(
      paths(
        altered((copy) => {
          listOf(copy).slots = [{ name: "x", type: "money", nullable: false }];
        }),
      ),
    ).toEqual(["queries.events.list.slots.0.type"]);
    expect(
      paths(
        altered((copy) => {
          listOf(copy).slots = [
            { name: "x", type: "int4[][]", nullable: false },
          ];
        }),
      ),
    ).toEqual(["queries.events.list.slots.0.type"]);
  });

  it("accepts a type that names an enum of the definition", () => {
    expect(
      paths(
        altered((copy) => {
          listOf(copy).slots = [
            { name: "days", type: "event_day[]", nullable: false },
          ];
        }),
      ),
    ).toEqual([]);
  });

  it("rejects two slots or two columns with one name", () => {
    expect(
      paths(
        altered((copy) => {
          listOf(copy).slots = [
            { name: "day", type: "text", nullable: false },
            { name: "day", type: "text", nullable: false },
          ];
        }),
      ),
    ).toEqual(["queries.events.list.slots.1"]);
    expect(
      paths(
        altered((copy) => {
          listOf(copy).columns = [
            { name: "id", type: "int4", nullable: false },
            { name: "id", type: "int4", nullable: false },
          ];
        }),
      ),
    ).toEqual(["queries.events.list.columns.1"]);
  });

  it("rejects a table with an extra or a missing member, or a kind it does not know", () => {
    expect(
      paths(
        altered((copy) => {
          tablesOf(copy).events = { kind: "table", columns: [], rows: 0 };
        }),
      ),
    ).toEqual(["tables.events"]);
    expect(
      paths(
        altered((copy) => {
          tablesOf(copy).events = { columns: [] };
        }),
      ),
    ).toEqual(["tables.events.kind"]);
    expect(
      paths(
        altered((copy) => {
          tablesOf(copy).events = { kind: "sequence", columns: [] };
        }),
      ),
    ).toEqual(["tables.events.kind"]);
  });

  it("rejects a table column that is not complete", () => {
    expect(
      paths(
        altered((copy) => {
          tablesOf(copy).events = {
            kind: "table",
            columns: [{ name: "x", type: "int4", nullable: false }],
          };
        }),
      ),
    ).toEqual(["tables.events.columns.0.generated"]);
  });

  it("accepts a table column of an unknown type and rejects any other type it does not know", () => {
    expect(paths(definition)).toEqual([]);
    expect(
      paths(
        altered((copy) => {
          tablesOf(copy).events = {
            kind: "table",
            columns: [
              { name: "x", type: "money", nullable: false, generated: false },
            ],
          };
        }),
      ),
    ).toEqual(["tables.events.columns.0.type"]);
  });

  it("rejects two table columns with one name", () => {
    expect(
      paths(
        altered((copy) => {
          tablesOf(copy).events = {
            kind: "table",
            columns: [
              { name: "id", type: "int4", nullable: false, generated: true },
              { name: "id", type: "int4", nullable: false, generated: false },
            ],
          };
        }),
      ),
    ).toEqual(["tables.events.columns.1"]);
  });

  it("reports every issue of a pass", () => {
    const copy = altered((copy) => {
      listOf(copy).slots = [
        { name: "x", type: "money", nullable: false },
        { name: "x", type: "text", nullable: false },
      ];
    });
    expect(paths(copy)).toEqual([
      "queries.events.list.slots.0.type",
      "queries.events.list.slots.1",
    ]);
  });
});
