import type { Query } from "./types";

import { readdir, readFile } from "node:fs/promises";
import { join, posix } from "node:path";

import { IDENTIFIER } from "@bezoar/schema";

import { EXTENSION, SILENT } from "./constant";
import { InvalidQueryError } from "./error";
import { rewrite } from "./slots";

/**
 * The SQL files under a directory, at any depth, as posix paths relative to
 * it, sorted. A directory that does not exist has none.
 */
const list = async (directory: string): Promise<string[]> => {
  let entries: string[];
  try {
    entries = await readdir(directory, { recursive: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
  return entries
    .map((entry) => entry.replaceAll("\\", "/"))
    .filter((entry) => entry.endsWith(EXTENSION))
    .sort();
};

/**
 * The name of a query: its path without the extension, with a dot for each
 * directory. `events/list.sql` is `events.list`.
 *
 * @throws InvalidQueryError when a directory or the file name is not an
 *   identifier.
 */
const nameOf = (path: string, file: string): string => {
  const segments = file.slice(0, -EXTENSION.length).split("/");
  for (const segment of segments) {
    if (!IDENTIFIER.test(segment)) {
      throw new InvalidQueryError(
        path,
        `has "${segment}" in its path; a query is named for its path, so each directory and the file name must be an identifier`,
      );
    }
  }
  return segments.join(".");
};

/**
 * The query of a file: the SQL trimmed, the trailing semicolon dropped, and
 * the slots rewritten.
 *
 * @throws InvalidQueryError when the file has no SQL or a slot the lexer
 *   rejects.
 */
const queryOf = (path: string, name: string, text: string): Query => {
  if (text.split("\n").every((line) => SILENT.test(line))) {
    throw new InvalidQueryError(path, "has no SQL");
  }
  try {
    const { text: sql, slots } = rewrite(text.trim().replace(/;\s*$/, ""));
    return { name, sql, slots, path };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new InvalidQueryError(path, error.message);
    }
    throw error;
  }
};

/**
 * Checks that no query is also a group: `events.sql` beside `events/` would
 * make `events` both a function and an object of the service.
 *
 * @throws InvalidQueryError for the query under the group.
 */
const disjoint = (queries: readonly Query[]) => {
  const names = new Set(queries.map((query) => query.name));
  for (const query of queries) {
    const segments = query.name.split(".");
    for (let depth = 1; depth < segments.length; depth += 1) {
      const group = segments.slice(0, depth).join(".");
      if (names.has(group)) {
        throw new InvalidQueryError(
          query.path,
          `is in the group ${group}, which is also the name of a query`,
        );
      }
    }
  }
};

/**
 * Reads the queries of a directory. Each file is one query, named for its
 * path: each directory is a group, and the file name is the name.
 *
 * @param root - The project root.
 * @param directory - The directory, relative to the root.
 * @throws InvalidQueryError for a path that does not name a query, a file
 *   without SQL, a slot the lexer rejects, or a query that is also a group.
 */
export const readQueries = async (
  root: string,
  directory: string,
): Promise<Query[]> => {
  const queries: Query[] = [];
  for (const file of await list(join(root, directory))) {
    const path = posix.join(directory, file);
    const name = nameOf(path, file);
    const text = await readFile(join(root, path), "utf8");
    queries.push(queryOf(path, name, text));
  }
  disjoint(queries);
  return queries;
};
