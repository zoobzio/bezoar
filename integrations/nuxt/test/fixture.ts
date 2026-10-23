import type { Definition, Grant, Migration, Seed } from "bezoar";

/** A contract for the runtime tests. */
export const contract = {
  enums: { event_day: ["sunday", "monday"] },
  queries: {
    "events.list": {
      slots: [{ name: "day", type: "event_day", nullable: false }],
      columns: [
        { name: "id", type: "int4", nullable: false },
        { name: "slug", type: "text", nullable: false },
      ],
    },
    "events.count": {
      slots: [],
      columns: [{ name: "total", type: "int8", nullable: false }],
    },
  },
  tables: {},
} as const satisfies Definition;

/** The SQL of each query. */
export const queries = {
  "events.list": "SELECT id, slug FROM events WHERE day = $1 ORDER BY id",
  "events.count": "SELECT count(*) AS total FROM events",
};

/** The migrations of the test database. */
export const migrations: Migration[] = [
  {
    version: "0001",
    name: "events",
    sql: "CREATE TYPE event_day AS ENUM ('sunday', 'monday'); CREATE TABLE events (id serial PRIMARY KEY, slug text NOT NULL UNIQUE, day event_day NOT NULL);",
    checksum: "a",
  },
];

/** The grants of the test database. */
export const roles: Grant[] = [
  { role: "web", sql: "GRANT SELECT ON events TO web;" },
];

/** The seeds of the test database. */
export const seeds: Seed[] = [
  {
    name: "events",
    sql: "INSERT INTO events (slug, day) VALUES ('worship', 'sunday') ON CONFLICT DO NOTHING;",
  },
];
