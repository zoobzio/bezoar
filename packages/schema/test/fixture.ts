import type { Definition } from "../src/types";

import { record } from "objectively";

/**
 * A definition for the test suites. The definition has one enum, queries
 * with and without columns, a nullable slot, a nullable column, an array
 * slot, an array column, and a column of each scalar family. Its tables
 * have a generated column, a nullable column, an enum column, an array
 * column, a column of an unknown type, and a view.
 */
export const definition = {
  enums: {
    event_day: [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ],
  },
  queries: {
    "events.list": {
      slots: [
        { name: "day", type: "event_day", nullable: false },
        { name: "location", type: "text", nullable: true },
      ],
      columns: [
        { name: "id", type: "int4", nullable: false },
        { name: "slug", type: "text", nullable: false },
        { name: "title", type: "text", nullable: false },
        { name: "day", type: "event_day", nullable: true },
        { name: "start_time", type: "time", nullable: false },
        { name: "weeks", type: "int4[]", nullable: true },
      ],
    },
    "events.bySlug": {
      slots: [{ name: "slug", type: "text", nullable: false }],
      columns: [
        { name: "id", type: "int4", nullable: false },
        { name: "slug", type: "text", nullable: false },
        { name: "title", type: "text", nullable: false },
      ],
    },
    "events.insert": {
      slots: [
        { name: "slug", type: "text", nullable: false },
        { name: "title", type: "text", nullable: false },
      ],
      columns: [],
    },
    "events.touch": {
      slots: [{ name: "ids", type: "int4[]", nullable: false }],
      columns: [],
    },
    "sermons.recent": {
      slots: [{ name: "limit", type: "int8", nullable: false }],
      columns: [
        { name: "id", type: "uuid", nullable: false },
        { name: "published_at", type: "timestamptz", nullable: false },
        { name: "meta", type: "jsonb", nullable: true },
        { name: "thumb", type: "bytea", nullable: true },
        { name: "live", type: "bool", nullable: false },
      ],
    },
  },
  tables: {
    events: {
      kind: "table",
      columns: [
        { name: "id", type: "int4", nullable: false, generated: true },
        { name: "slug", type: "text", nullable: false, generated: false },
        { name: "day", type: "event_day", nullable: true, generated: false },
        { name: "weeks", type: "int4[]", nullable: true, generated: false },
        { name: "ip", type: "unknown", nullable: true, generated: false },
      ],
    },
    upcoming: {
      kind: "view",
      columns: [
        { name: "id", type: "int4", nullable: false, generated: false },
        { name: "slug", type: "text", nullable: true, generated: false },
      ],
    },
  },
} as const satisfies Definition;

/** A row of `events.list` that passes its validator. */
export const eventRow = {
  id: 1,
  slug: "worship-service",
  title: "Worship Service",
  day: "sunday",
  start_time: "10:30:00",
  weeks: [1, 3, null],
};

/** A row of `sermons.recent` that passes its validator. */
export const sermonRow = {
  id: "3b241101-e2bb-4255-8caf-4136c566a962",
  published_at: new Date(0),
  meta: { views: 1 },
  thumb: new Uint8Array(1),
  live: false,
};

/**
 * The fixture with one change applied to a plain copy. The change receives
 * the copy as untyped data. A test can make the copy invalid.
 */
export const altered = (
  change: (copy: Record<string, unknown>) => void,
): Record<string, unknown> => {
  const copy: Record<string, unknown> = structuredClone(definition);
  change(copy);
  return copy;
};

/** A member of a copy, as a record. */
const memberOf = (
  copy: Record<string, unknown>,
  key: string,
): Record<string, unknown> => {
  const member = copy[key];
  if (!record(member)) {
    throw new TypeError(`${key} is not a record`);
  }
  return member;
};

/** The queries of an altered copy. */
export const queriesOf = (copy: Record<string, unknown>) =>
  memberOf(copy, "queries");

/** The tables of an altered copy. */
export const tablesOf = (copy: Record<string, unknown>) =>
  memberOf(copy, "tables");

/** The statement of `events.list` in an altered copy. */
export const listOf = (copy: Record<string, unknown>) =>
  memberOf(queriesOf(copy), "events.list");
