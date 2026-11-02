import type { Database, KitConfig, Settings } from "./types";

import { MIGRATIONS, OUT_DIR, QUERIES, ROLES, SEEDS } from "./constant";
import { InvalidConfigError } from "./error";
import { inside, normalize } from "./path";

/**
 * Whether a value is a plain object: PGlite options, as far as the kit can
 * tell without PGlite.
 */
const plain = (value: unknown): value is object =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null);

/**
 * Checks a config against every rule that can be decided without reading a
 * file, and applies its defaults. Each directory must be inside the project
 * root, and the database, if given, must be PGlite options or a function.
 *
 * @param config - The authored config.
 * @throws InvalidConfigError carrying every issue found.
 */
export const validate = (config: KitConfig): Settings => {
  const issues: string[] = [];

  const directory = (label: string, path: unknown, fallback: string) => {
    if (path === undefined) {
      return fallback;
    }
    if (typeof path !== "string" || !inside(normalize(path))) {
      issues.push(`${label} must be a directory inside the project root`);
      return fallback;
    }
    return normalize(path);
  };

  const database = (value: unknown): Database => {
    if (value === undefined) {
      return {};
    }
    if (typeof value === "function" || plain(value)) {
      return value as Database;
    }
    issues.push(
      "database must be PGlite options or a function that makes the client",
    );
    return {};
  };

  const settings: Settings = {
    migrations: directory("migrations", config.migrations, MIGRATIONS),
    seeds: directory("seeds", config.seeds, SEEDS),
    queries: directory("queries", config.queries, QUERIES),
    roles: directory("roles", config.roles, ROLES),
    outDir: directory("outDir", config.outDir, OUT_DIR),
    database: database(config.database),
  };

  if (issues.length > 0) {
    throw new InvalidConfigError(issues);
  }
  return settings;
};
