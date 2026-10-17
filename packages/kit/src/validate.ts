import type { KitConfig, Settings } from "./types";

import { MIGRATIONS, OUT_DIR, QUERIES, SEEDS } from "./constant";
import { InvalidConfigError } from "./error";
import { inside, normalize } from "./path";

/**
 * Checks a config against every rule that can be decided without reading a
 * file, and applies its defaults. Each directory must be inside the project
 * root.
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

  const settings: Settings = {
    migrations: directory("migrations", config.migrations, MIGRATIONS),
    seeds: directory("seeds", config.seeds, SEEDS),
    queries: directory("queries", config.queries, QUERIES),
    outDir: directory("outDir", config.outDir, OUT_DIR),
  };

  if (issues.length > 0) {
    throw new InvalidConfigError(issues);
  }
  return settings;
};
