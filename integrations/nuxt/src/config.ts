import type { DRIVERS } from "./constant";

/**
 * A driver the module can connect with.
 */
export type Driver = (typeof DRIVERS)[number];

/**
 * The module's configuration.
 *
 * ```ts
 * export default defineNuxtConfig({
 *   modules: ["@bezoar/nuxt"],
 *   bezoar: { build: "@acme/database", migrate: true },
 * });
 * ```
 */
export interface NuxtBezoarConfig {
  /**
   * A kit build: the output directory `bezoar build` wrote. A path,
   * relative to the project root or absolute, to the directory or its
   * `index.mjs`, or a package whose main entry is that `index.mjs`.
   */
  build: string;

  /**
   * The driver. `pg` connects to a Postgres server with the connection
   * string of the runtime config. `pglite` runs Postgres in the process.
   * Defaults to `pg`.
   */
  driver?: Driver;

  /**
   * Whether the server applies the migrations of the build when it starts.
   * Defaults to `false`.
   */
  migrate?: boolean;

  /**
   * Whether the server runs the seeds of the build when it starts, after
   * the migrations. Defaults to `false`.
   */
  seed?: boolean;
}

/**
 * The runtime config of the module, under `runtimeConfig.bezoar`. An
 * environment variable sets each member: `NUXT_BEZOAR_URL` sets `url`.
 */
export interface BezoarRuntimeConfig {
  /** The connection string, for the `pg` driver. */
  url: string;

  /** The data directory, for the `pglite` driver. Empty for memory. */
  dataDir: string;

  /** The driver. */
  driver: Driver;

  /** Whether the server applies the migrations when it starts. */
  migrate: boolean;

  /** Whether the server runs the seeds when it starts. */
  seed: boolean;
}

/**
 * Identity helper that types a Nuxt bezoar configuration.
 *
 * @param config - The Nuxt bezoar configuration.
 * @returns The same config.
 */
export const defineBezoarConfig = (config: NuxtBezoarConfig) => config;
