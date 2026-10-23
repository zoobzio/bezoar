import { defineNuxtConfig } from "nuxt/config";

/**
 * The bezoar example: the booking desk of Solstice Rail, a fictional
 * night-train company.
 *
 * The database lives in `@bezoar/example-database`, built there with
 * `@bezoar/kit`. `build` points the module at that build. The `pglite`
 * driver runs Postgres in the process, in memory, and the server declares
 * the roles, applies the migrations and the grants, and runs the seeds when
 * it starts, so the example needs no database and no setup. The server
 * routes call `useBezoar()`, which is scoped to the `desk` role: it offers
 * the queries of the desk, typed so, and runs them as the desk.
 */
export default defineNuxtConfig({
  compatibilityDate: "2026-07-01",
  modules: ["@bezoar/nuxt"],
  bezoar: {
    build: "@bezoar/example-database",
    driver: "pglite",
    migrate: true,
    seed: true,
    roles: true,
    role: "desk",
  },
});
