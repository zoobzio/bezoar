/**
 * The virtual modules the module adds to the server build: the build of the
 * app, and its service. A virtual module is bundled in dev and in production
 * alike, so the plugin of the runtime, which imports both, is too.
 */
export const VIRTUAL = {
  build: "#bezoar/build",
  service: "#bezoar/service",
} as const;

/**
 * The declaration of the service, in the build directory. It declares the
 * virtual service module, so the server is typed by the build.
 */
export const DECLARATION = "types/bezoar.d.ts";

/**
 * The modules of a kit build the module adopts. Every build has these.
 */
export const ENTRIES = ["index", "queries", "migrations", "seeds"] as const;

/**
 * The module of a kit build that carries its grants. A build made before
 * roles existed has none, and the virtual build then exports no grant.
 */
export const ROLES = "roles";

/**
 * The export of each module of a kit build, re-exported by the virtual
 * build. Named, not `export *`: the modules are external to the server
 * bundle in dev, and a bundler cannot tell which of several external modules
 * a star re-export provides a name from.
 */
export const EXPORTS: Record<(typeof ENTRIES)[number], string> = {
  index: "contract",
  queries: "queries",
  migrations: "migrations",
  seeds: "seeds",
};

/**
 * The export of the roles module, re-exported by the virtual build.
 */
export const ROLES_EXPORT = "roles";

/**
 * The drivers the module can connect with. `pg` connects to a server with
 * the connection string of the runtime config. `pglite` runs Postgres in the
 * process, on the data directory of the runtime config, or in memory.
 */
export const DRIVERS = ["pg", "pglite"] as const;
