import type { Definition, Migration, Seed } from "bezoar";

import type { Defined } from "./service";

import { defineNitroPlugin, useRuntimeConfig } from "#imports";

/**
 * What the plugin of an app runs with: its service, and the migrations and
 * the seeds of its build.
 */
export interface Startup<D extends Definition> extends Defined<D> {
  migrations: readonly Migration[];
  seeds: readonly Seed[];
}

/**
 * Defines the plugin of an app. The plugin of the runtime calls this with
 * the virtual service and the virtual build of the app.
 *
 * The plugin makes the service when the server starts. When the runtime
 * config asks, it applies the migrations of the build and runs its seeds.
 * It closes the connection when the server stops.
 *
 * @param startup - The service, the migrations, and the seeds.
 */
export const definePlugin = <D extends Definition>(startup: Startup<D>) =>
  defineNitroPlugin(async (nitroApp) => {
    const { migrate, seed } = useRuntimeConfig().bezoar;
    const db = startup.useBezoar();
    if (migrate) {
      await db.migrate(startup.migrations);
    }
    if (seed) {
      await db.seed(startup.seeds);
    }
    nitroApp.hooks.hook("close", startup.closeBezoar);
  });
