import type { BezoarRuntimeConfig, NuxtBezoarConfig } from "./config";

import { dirname } from "node:path";

import {
  addServerImports,
  addServerPlugin,
  addServerTemplate,
  addTypeTemplate,
  createResolver,
  defineNuxtModule,
} from "@nuxt/kit";
import { record } from "objectively";

import { locate } from "./build";
import { DECLARATION, VIRTUAL } from "./constant";
import { build, declaration, service } from "./templates";

/**
 * Nuxt module for bezoar.
 *
 * The module takes a kit build, the output of `bezoar build` in a
 * database package, and adds two virtual modules to the server build: the
 * build of the app, which re-exports the modules of the kit build, and the
 * service of the app, over the contract and the SQL of that build. A
 * declaration in the build directory types the service by the contract. The
 * module provides `useBezoar()` to the server from the virtual service: a
 * service over the contract of the build, typed by it, connected through
 * the driver and the connection string of the runtime config, and scoped
 * to the role of the options when there is one. The plugin of the runtime
 * makes the service when the server starts, declares the roles, applies the
 * migrations, applies the grants, and runs the seeds of the virtual build
 * when the config asks, and closes the connection when the server stops.
 *
 * The modules are virtual, not written, so Nitro bundles them in dev as in
 * production. Nitro loads a written file through Node in dev, where neither
 * `#imports` nor a virtual module exists.
 */
export default defineNuxtModule<NuxtBezoarConfig>({
  meta: {
    name: "bezoar",
    configKey: "bezoar",
  },
  setup: async (options, nuxt) => {
    if (typeof options.build !== "string" || options.build === "") {
      throw new Error(
        "bezoar: `build` must name a kit build, as a package or a path",
      );
    }

    const resolver = createResolver(import.meta.url);
    const sources = {
      build: await locate(options.build, nuxt.options.rootDir),
      runtime: dirname(await resolver.resolvePath("./runtime/server/service")),
    };

    nuxt.options.build.transpile.push(sources.runtime);

    addServerTemplate({
      filename: VIRTUAL.build,
      getContents: () => build(sources),
    });
    addServerTemplate({
      filename: VIRTUAL.service,
      getContents: () => service(sources),
    });
    // Referenced from the server project, where the routes call
    // `useBezoar()`, and from the app project, which types a route's
    // response from the server file that returns it.
    addTypeTemplate(
      {
        filename: DECLARATION,
        getContents: () => declaration(sources, options.role),
      },
      { nitro: true, nuxt: true },
    );

    const defaults: BezoarRuntimeConfig = {
      url: "",
      dataDir: "",
      driver: options.driver ?? "pg",
      migrate: options.migrate ?? false,
      seed: options.seed ?? false,
      roles: options.roles ?? false,
      role: options.role ?? "",
    };
    const given = nuxt.options.runtimeConfig.bezoar;
    nuxt.options.runtimeConfig.bezoar = {
      ...defaults,
      ...(record(given) ? given : {}),
    };

    addServerPlugin(await resolver.resolvePath("./runtime/server/plugin"));
    addServerImports([
      { from: VIRTUAL.service, name: "useBezoar" },
      { from: VIRTUAL.service, name: "useBezoarOwner" },
      { from: VIRTUAL.service, name: "closeBezoar" },
      ...[
        "AppBezoar",
        "AppBezoarContract",
        "AppBezoarQuery",
        "AppBezoarArguments",
        "AppBezoarRow",
        "AppBezoarDatabase",
        "AppBezoarRole",
      ].map((name) => ({ from: VIRTUAL.service, name, type: true })),
    ]);
  },
});
