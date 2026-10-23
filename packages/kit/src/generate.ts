import type { KitConfig, Output } from "./types";

import { pglite } from "@bezoar/pglite";
import { PGlite } from "@electric-sql/pglite";

import { apply } from "./apply";
import { readEnums } from "./enums";
import { describeQueries } from "./describe";
import { emit } from "./emit";
import { readSources } from "./read";
import { define, readTypes } from "./resolve";
import { checkRoles } from "./roles";
import { columnsOf, readRelations } from "./tables";
import { validate } from "./validate";

/**
 * Generates the output of a project without writing it. The function
 * validates the config, reads the SQL, applies the roles, the migrations,
 * the grants, and the seeds to a database in memory, reads the enums and
 * the columns, describes each query, checks each query under each role,
 * builds the contract, and emits the files.
 *
 * @param config - The authored config.
 * @param root - The project root.
 */
export const generate = async (
  config: KitConfig,
  root: string,
): Promise<Output> => {
  const settings = validate(config);
  const sources = await readSources(root, settings);

  const client = new PGlite();
  const executor = pglite(client);
  try {
    await apply(executor, sources);
    const enums = await readEnums(executor);
    const relations = await readRelations(executor);
    const described = await describeQueries(
      client,
      sources.queries,
      columnsOf(relations),
    );
    const types = await readTypes(executor, described, relations);
    const roles = await checkRoles(executor, sources.queries, sources.roles);
    const contract = define(
      sources.queries,
      described,
      types,
      enums,
      relations,
      roles,
    );
    return {
      outDir: settings.outDir,
      files: emit(sources, contract),
      sources,
      enums,
      contract,
    };
  } finally {
    await executor.close();
  }
};
