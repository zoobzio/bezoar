import type { Output } from "./types";

import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { readManifest, writeManifest } from "./manifest";

/**
 * Writes the files of an output under `<root>/<outDir>`. The directory is
 * never cleared. The files of the kit are overwritten in place. The only
 * files removed are the ones the previous write recorded in its manifest and
 * this output no longer produces.
 *
 * @param output - The output to write.
 * @param root - The project root.
 */
export const writeOutput = async (
  output: Output,
  root: string,
): Promise<void> => {
  const dir = resolve(root, output.outDir);
  await mkdir(dir, { recursive: true });

  const produced = output.files.map((file) => file.path);
  for (const path of await readManifest(dir)) {
    if (!produced.includes(path)) {
      await rm(join(dir, path), { force: true });
    }
  }

  for (const file of output.files) {
    const target = join(dir, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.contents);
  }
  await writeManifest(dir, produced);
};
