import type { MigrationFile, SeedFile, Settings, Sources } from "./types";

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { basename, join, posix } from "node:path";

import { EXTENSION, MIGRATION } from "./constant";
import { readQueries } from "./queries";

/**
 * The SQL files of a directory, sorted by name. A directory that does not
 * exist has none.
 */
const list = async (directory: string): Promise<string[]> => {
  let entries: string[];
  try {
    entries = await readdir(directory);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
  return entries.filter((entry) => entry.endsWith(EXTENSION)).sort();
};

/**
 * The SHA-256 of a text, in hex.
 */
const checksum = (text: string): string =>
  createHash("sha256").update(text).digest("hex");

/**
 * The version and the name of a migration, from its file name. A name of the
 * form `<digits>_<rest>` gives the digits as the version and the rest as the
 * name. Any other name is both.
 */
const identity = (file: string): { version: string; name: string } => {
  const stem = basename(file, EXTENSION);
  const match = MIGRATION.exec(stem);
  if (!match) {
    return { version: stem, name: stem };
  }
  const [, version = stem, name = stem] = match;
  return { version, name };
};

/**
 * Reads the migrations of a directory, in file name order. The file name
 * orders a migration and is its version.
 *
 * @param root - The project root.
 * @param directory - The directory, relative to the root.
 */
export const readMigrations = async (
  root: string,
  directory: string,
): Promise<MigrationFile[]> => {
  const migrations: MigrationFile[] = [];
  for (const file of await list(join(root, directory))) {
    const path = posix.join(directory, file);
    const sql = await readFile(join(root, path), "utf8");
    migrations.push({ path, ...identity(file), sql, checksum: checksum(sql) });
  }
  return migrations;
};

/**
 * Reads the seeds of a directory, in file name order. The name is the file
 * name without the extension.
 *
 * @param root - The project root.
 * @param directory - The directory, relative to the root.
 */
export const readSeeds = async (
  root: string,
  directory: string,
): Promise<SeedFile[]> => {
  const seeds: SeedFile[] = [];
  for (const file of await list(join(root, directory))) {
    const path = posix.join(directory, file);
    seeds.push({
      path,
      name: basename(file, EXTENSION),
      sql: await readFile(join(root, path), "utf8"),
    });
  }
  return seeds;
};

/**
 * Reads the SQL of a project.
 *
 * @param root - The project root.
 * @param settings - The validated config.
 */
export const readSources = async (
  root: string,
  settings: Settings,
): Promise<Sources> => ({
  migrations: await readMigrations(root, settings.migrations),
  seeds: await readSeeds(root, settings.seeds),
  queries: await readQueries(root, settings.queries),
});
