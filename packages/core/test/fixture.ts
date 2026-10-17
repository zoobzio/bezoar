import type { Definition } from "@bezoar/schema";

import type { Executor, Outcome } from "../src/types";

/**
 * A contract for the test suites: an enum, queries with and without columns,
 * a nullable slot, and a nullable column.
 */
export const contract = {
  enums: {
    event_day: ["sunday", "monday", "tuesday"],
  },
  queries: {
    "events.list": {
      slots: [
        { name: "day", type: "event_day", nullable: false },
        { name: "location", type: "text", nullable: true },
      ],
      columns: [
        { name: "id", type: "int4", nullable: false },
        { name: "title", type: "text", nullable: false },
        { name: "day", type: "event_day", nullable: true },
      ],
    },
    "events.bySlug": {
      slots: [{ name: "slug", type: "text", nullable: false }],
      columns: [
        { name: "id", type: "int4", nullable: false },
        { name: "title", type: "text", nullable: false },
      ],
    },
    "events.insert": {
      slots: [{ name: "title", type: "text", nullable: false }],
      columns: [],
    },
    "events.archive": {
      slots: [{ name: "ids", type: "int4[]", nullable: false }],
      columns: [],
    },
    "events.count": {
      slots: [],
      columns: [{ name: "total", type: "int8", nullable: false }],
    },
  },
} as const satisfies Definition;

/** The SQL of each query, with the slots at their positions. */
export const queries = {
  "events.list":
    "SELECT id, title, day FROM events WHERE day = $1 AND ($2 IS NULL OR location = $2)",
  "events.bySlug": "SELECT id, title FROM events WHERE slug = $1",
  "events.insert": "INSERT INTO events (title) VALUES ($1)",
  "events.archive": "UPDATE events SET archived = true WHERE id = ANY($1)",
  "events.count": "SELECT count(*) AS total FROM events",
};

/** One call a fake executor received. */
export interface Call {
  kind: "query" | "exec";
  sql: string;
  params?: readonly unknown[];
  depth: number;
}

/**
 * A fake executor for the tests. `calls` records each call with the depth of
 * the transaction it ran in. `answer` decides the outcome of a query from
 * its SQL. `transaction` runs the function with a fake one level deeper and
 * records whether it committed or rolled back.
 */
export interface Fake extends Executor {
  calls: Call[];
  ends: ("commit" | "rollback")[];
}

export const fake = (
  answer: (sql: string, params: readonly unknown[]) => Outcome = () => ({
    rows: [],
    count: 0,
  }),
  calls: Call[] = [],
  ends: ("commit" | "rollback")[] = [],
  depth = 0,
): Fake => ({
  calls,
  ends,
  query: async (sql, params) => {
    calls.push({ kind: "query", sql, params, depth });
    return answer(sql, params);
  },
  exec: async (sql) => {
    calls.push({ kind: "exec", sql, depth });
    if (sql.includes("FAIL")) {
      throw new Error(`driver: ${sql}`);
    }
  },
  transaction: async (run) => {
    try {
      const result = await run(fake(answer, calls, ends, depth + 1));
      ends.push("commit");
      return result;
    } catch (error) {
      ends.push("rollback");
      throw error;
    }
  },
});
