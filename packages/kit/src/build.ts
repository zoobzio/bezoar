import type { BuildOptions, Output } from "./types";

import { resolve } from "node:path";

import { FILENAME } from "./constant";
import { generate } from "./generate";
import { loadConfig } from "./load";
import { writeOutput } from "./write";

/**
 * The whole build: load the config, generate, and write the output
 * directory. What the CLI runs.
 *
 * @param options - The root and the config path.
 */
export const build = async (options: BuildOptions = {}): Promise<Output> => {
  const root = resolve(options.root ?? process.cwd());
  const config = await loadConfig(resolve(root, options.config ?? FILENAME));
  const output = await generate(config, root);
  await writeOutput(output, root);
  return output;
};
