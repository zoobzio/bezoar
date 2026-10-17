import { defineBuildConfig } from "obuild/config";

/**
 * The runtime files, one entry each. Nuxt resolves them by path and bundles
 * them in the app, where `#imports` and the virtual modules of the module
 * exist.
 */
const runtime = ["service", "startup", "plugin", "types"].map(
  (name) => `./src/runtime/server/${name}.ts`,
);

export default defineBuildConfig({
  entries: [
    {
      type: "bundle",
      input: [
        "./src/module.ts",
        "./src/config.ts",
        "./src/constant.ts",
        ...runtime,
      ],
      outDir: ".dist",
      rolldown: {
        external: [
          "@nuxt/schema",
          "nuxt",
          "nuxt/schema",
          "#bezoar/build",
          "#bezoar/service",
        ],
      },
    },
  ],
  hooks: {
    // Emitted as `.js` with `.d.ts`. Nuxt writes the `#imports` types with
    // the extension stripped, and TypeScript resolves a bare path to a
    // `.d.ts` only.
    rolldownOutput: (output) => {
      output.entryFileNames = "[name].js";
      output.chunkFileNames = "_chunks/[name].js";
    },
  },
});
