import type { Definition, Grant, Migration, Scoping, Seed } from "bezoar";

import type { Defined } from "./service";

import { defineNitroPlugin, useRuntimeConfig } from "#imports";

/**
 * What the plugin of an app runs with: its service, and the migrations,
 * the seeds, and the grants of its build.
 */
export interface Startup<
  D extends Definition,
  R extends Scoping<D> = undefined,
> extends Defined<D, R> {
  migrations: readonly Migration[];
  seeds: readonly Seed[];
  roles: readonly Grant[];
}

/**
 * Defines the plugin of an app. The plugin of the runtime calls this with
 * the virtual service and the virtual build of the app.
 *
 * The plugin makes the service when the server starts. When the runtime
 * config asks, it declares the roles of the build, applies its migrations,
 * applies its grants, and runs its seeds, in that order, on the service of
 * the owner. It closes the connection when the server stops.
 *
 * @param startup - The service, the migrations, the seeds, and the grants.
 */
export const definePlugin = <
  D extends Definition,
  R extends Scoping<D> = undefined,
>(
  startup: Startup<D, R>,
) =>
  defineNitroPlugin(async (nitroApp) => {
    const { migrate, seed, roles } = useRuntimeConfig().bezoar;
    startup.useBezoar();
    const owner = startup.useBezoarOwner();
    if (roles) {
      await owner.roles.declare(startup.roles);
    }
    if (migrate) {
      await owner.migrate(startup.migrations);
    }
    if (roles) {
      await owner.roles(startup.roles);
    }
    if (seed) {
      await owner.seed(startup.seeds);
    }
    nitroApp.hooks.hook("close", startup.closeBezoar);
  });
