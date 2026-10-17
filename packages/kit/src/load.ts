import type { KitConfig } from "./types";

import { existsSync } from "node:fs";

import { createJiti } from "jiti";
import { record } from "objectively";

import { MalformedConfigError, MissingConfigError } from "./error";

/**
 * Loads a `bezoar.config.ts`, or any TypeScript or JavaScript config
 * file, through jiti and returns its default export. The export must be a
 * plain record. {@link validate} checks its members.
 *
 * @param path - The absolute path to the config file.
 * @throws MissingConfigError when there is no file at `path`.
 * @throws MalformedConfigError when the default export is not a record.
 */
export const loadConfig = async (path: string): Promise<KitConfig> => {
  if (!existsSync(path)) {
    throw new MissingConfigError(path);
  }
  const jiti = createJiti(import.meta.url, { moduleCache: false });
  const config = await jiti.import<unknown>(path, { default: true });
  if (!record(config)) {
    throw new MalformedConfigError(path);
  }
  return config;
};
