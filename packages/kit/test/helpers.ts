import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** The fixture project: two migrations and a seed. */
export const FIXTURE = fileURLToPath(
  new URL("./fixtures/project/", import.meta.url),
);

/**
 * A throwaway project root holding a copy of the fixture, for tests that
 * write or change files.
 */
export const project = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "bezoar-kit-"));
  await cp(FIXTURE, root, { recursive: true });
  return root;
};

/** Removes a root that {@link project} made. */
export const discard = async (root: string): Promise<void> => {
  await rm(root, { recursive: true, force: true });
};
