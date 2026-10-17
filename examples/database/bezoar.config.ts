import { defineConfig } from "@bezoar/kit";

/**
 * The database of Solstice Rail, a fictional night-train company: the
 * stations, the routes between them, the departures on each route, and the
 * bookings on each departure. `bezoar build` writes the contract, the
 * SQL, the migrations, and the seeds to `.dist/`, which this package
 * exports.
 */
export default defineConfig({
  outDir: ".dist",
});
