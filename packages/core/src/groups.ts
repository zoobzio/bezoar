import type { Definition, Query } from "@bezoar/schema";

import type { Groups } from "./types";

import { record, rekey } from "objectively";

import { AmbiguousQueryError, ReservedQueryError } from "./error";

/**
 * A level of the groups: a plain object whose members are functions or
 * further levels.
 */
type Level = Record<string, unknown>;

/**
 * Returns the level under a segment of a level. Makes the level when the
 * segment has none.
 *
 * @throws AmbiguousQueryError when the segment holds a function.
 */
const descend = (level: Level, segment: string, name: string): Level => {
  const next = level[segment] ?? {};
  if (!record(next)) {
    throw new AmbiguousQueryError(name);
  }
  level[segment] = next;
  return next;
};

/**
 * Puts the function of a query under the last segment of its name.
 *
 * @throws AmbiguousQueryError when the segment holds a level.
 */
const place = (
  level: Level,
  segment: string,
  name: string,
  fn: (args?: unknown) => Promise<unknown>,
) => {
  if (segment in level) {
    throw new AmbiguousQueryError(name);
  }
  level[segment] = fn;
};

/**
 * Builds the {@link Groups} of a contract: one function per query, under an
 * object per group. A dot in a name is a level.
 *
 * @param names - The query names of the contract.
 * @param reserved - The names the service keeps for its own members. A
 *   top-level group or query cannot take one.
 * @param method - Makes the function of a query, with any siblings on it.
 * @throws ReservedQueryError when a top-level name is reserved.
 * @throws AmbiguousQueryError when a name is both a query and a group.
 */
export const defineGroups = <D extends Definition>(
  names: readonly Query<D>[],
  reserved: ReadonlySet<string>,
  method: (query: Query<D>) => (args?: unknown) => Promise<unknown>,
): Groups<D> => {
  const root: Level = {};

  for (const name of names) {
    const segments = name.split(".");
    const last = segments.pop()!;
    if (reserved.has(segments[0] ?? last)) {
      throw new ReservedQueryError(name);
    }

    let level = root;
    for (const segment of segments) {
      level = descend(level, segment, name);
    }
    place(level, last, name, method(name));
  }

  return rekey<Level, Groups<D>>(root, (key, value) => [key, value]);
};
