import { defineNuxtConfig } from "nuxt/config";

/**
 * The bezoar example: the booking desk of Solstice Rail, a fictional
 * night-train company.
 *
 * The database lives in `@bezoar/example-database`, built there with
 * `@bezoar/kit`. `build` points the module at that build. The `pglite`
 * driver runs Postgres in the process, in memory, and the server applies
 * the migrations and runs the seeds when it starts, so the example needs no
 * database and no setup. The server routes call `useBezoar()`.
 */
export default defineNuxtConfig({
  compatibilityDate: "2026-07-01",
  modules: ["@bezoar/nuxt"],
  bezoar: {
    build: "@bezoar/example-database",
    driver: "pglite",
    migrate: true,
    seed: true,
  },
});
