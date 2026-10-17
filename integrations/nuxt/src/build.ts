import { existsSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { directoryToURL, tryResolveModule } from "@nuxt/kit";

import { ENTRIES } from "./constant";

/**
 * Finds the output directory of a kit build. `build` is a path, relative to
 * the project root or absolute, to the directory or to its `index.mjs`, or
 * a package whose main entry is that `index.mjs`.
 *
 * @param build - The module's `build` option.
 * @param root - The project root.
 * @throws when nothing resolves, or what does is not a kit build.
 */
export const locate = async (build: string, root: string): Promise<string> => {
  let path: string | undefined;
  if (build.startsWith(".") || isAbsolute(build)) {
    path = resolve(root, build);
  } else {
    const resolved = await tryResolveModule(build, directoryToURL(root));
    path = resolved?.startsWith("file:") ? fileURLToPath(resolved) : resolved;
  }
  if (path === undefined || !existsSync(path)) {
    throw new Error(
      `bezoar: \`build\` ${JSON.stringify(build)} could not be found from ${root}`,
    );
  }
  const directory = statSync(path).isFile() ? dirname(path) : path;
  for (const entry of ENTRIES) {
    if (!existsSync(join(directory, `${entry}.mjs`))) {
      throw new Error(
        `bezoar: ${directory} is not a kit build; it has no ${entry}.mjs (run \`bezoar build\` there first)`,
      );
    }
  }
  return directory;
};
