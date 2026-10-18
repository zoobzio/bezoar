import type { Migration, Seed } from "@bezoar/core";
import type { Definition } from "@bezoar/schema";

/**
 * The migrations of the test database: an enum, a table with a column of
 * each scalar family, and an array of the enum.
 */
export const migrations: Migration[] = [
  {
    version: "0001",
    name: "events",
    checksum: "a",
    sql: `
      CREATE TYPE event_day AS ENUM ('sunday', 'monday', 'tuesday');
      CREATE TABLE events (
        id serial PRIMARY KEY,
        slug text NOT NULL UNIQUE,
        title text NOT NULL,
        day event_day,
        days event_day[] NOT NULL DEFAULT '{}',
        weeks int4[],
        start_time time NOT NULL DEFAULT '10:30',
        held_on date,
        noted_at timestamp,
        created_at timestamptz NOT NULL DEFAULT now(),
        price numeric(8, 2) NOT NULL DEFAULT 0,
        meta jsonb,
        thumb bytea,
        live boolean NOT NULL DEFAULT false,
        views int8 NOT NULL DEFAULT 0
      );
    `,
  },
  {
    version: "0002",
    name: "staff",
    checksum: "b",
    sql: `CREATE TABLE staff (id serial PRIMARY KEY, name text NOT NULL);`,
  },
];

/** The seeds of the test database. */
export const seeds: Seed[] = [
  {
    name: "events",
    sql: `
      INSERT INTO events (slug, title, day, days, weeks, held_on, noted_at, price, meta, thumb, live, views)
      VALUES
        ('worship', 'Worship', 'sunday', '{sunday}', '{1,3}', '2026-10-18', '2026-10-18 10:30:00', '12.50', '{"a":[1]}', '\\x0102', true, 9007199254740991),
        ('study', 'Study', NULL, '{monday,tuesday}', NULL, NULL, NULL, '0', NULL, NULL, false, 0)
      ON CONFLICT (slug) DO NOTHING;
    `,
  },
];

/** The contract of the test database. */
export const contract = {
  enums: {
    event_day: ["sunday", "monday", "tuesday"],
  },
  queries: {
    "events.list": {
      slots: [{ name: "day", type: "event_day", nullable: true }],
      columns: [
        { name: "id", type: "int4", nullable: false },
        { name: "slug", type: "text", nullable: false },
        { name: "day", type: "event_day", nullable: true },
        { name: "days", type: "event_day[]", nullable: false },
        { name: "weeks", type: "int4[]", nullable: true },
        { name: "start_time", type: "time", nullable: false },
        { name: "held_on", type: "date", nullable: true },
        { name: "noted_at", type: "timestamp", nullable: true },
        { name: "created_at", type: "timestamptz", nullable: false },
        { name: "price", type: "numeric", nullable: false },
        { name: "meta", type: "jsonb", nullable: true },
        { name: "thumb", type: "bytea", nullable: true },
        { name: "live", type: "bool", nullable: false },
        { name: "views", type: "int8", nullable: false },
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
      slots: [
        { name: "slug", type: "text", nullable: false },
        { name: "title", type: "text", nullable: false },
      ],
      columns: [{ name: "id", type: "int4", nullable: false }],
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
  tables: {},
} as const satisfies Definition;

/** The SQL of each query. */
export const queries = {
  "events.list": `
    SELECT id, slug, day, days, weeks, start_time, held_on, noted_at, created_at, price, meta, thumb, live, views
    FROM events
    WHERE $1::event_day IS NULL OR day = $1
    ORDER BY id`,
  "events.bySlug": "SELECT id, title FROM events WHERE slug = $1",
  "events.insert":
    "INSERT INTO events (slug, title) VALUES ($1, $2) RETURNING id",
  "events.archive": "UPDATE events SET live = false WHERE id = ANY($1)",
  "events.count": "SELECT count(*) AS total FROM events",
};
