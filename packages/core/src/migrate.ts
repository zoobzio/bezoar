import type { Executor, Migration } from "./types";

import { ACQUIRE, APPLIED, CREATE, LOCK, RECORD } from "./constant";
import { MigrationDriftError, MigrationError } from "./error";

/**
 * Reads the applied migrations of the database: the checksum of each, by
 * version.
 */
const applied = async (tx: Executor): Promise<Map<string, string>> => {
  const { rows } = await tx.query(APPLIED, []);
  const found = new Map<string, string>();
  for (const row of rows) {
    found.set(String(row.version), String(row.checksum));
  }
  return found;
};

/**
 * Compares the applied migrations with the list.
 *
 * @throws MigrationDriftError when an applied version is not in the list, or
 *   has another checksum in the list.
 */
const compare = (
  checksums: Map<string, string>,
  migrations: readonly Migration[],
) => {
  const listed = new Set(migrations.map((migration) => migration.version));
  for (const version of checksums.keys()) {
    if (!listed.has(version)) {
      throw new MigrationDriftError(version, "is applied but not listed");
    }
  }
  for (const migration of migrations) {
    const checksum = checksums.get(migration.version);
    if (checksum !== undefined && checksum !== migration.checksum) {
      throw new MigrationDriftError(
        migration.version,
        "changed after it was applied",
      );
    }
  }
};

/**
 * Applies one migration and records it.
 *
 * @throws MigrationError when the SQL fails.
 */
const apply = async (tx: Executor, migration: Migration) => {
  try {
    await tx.exec(migration.sql);
  } catch (cause) {
    throw new MigrationError(migration.version, cause);
  }
  await tx.query(RECORD, [
    migration.version,
    migration.name,
    migration.checksum,
  ]);
};

/**
 * Applies the migrations the database lacks. The run is one transaction
 * under an advisory lock. The lock makes two runs wait for each other. The
 * transaction makes the run all or nothing.
 *
 * The run compares the list with the database first. An applied version with
 * another checksum is drift. An applied version that the list does not have
 * is drift. Drift stops the run.
 *
 * @param executor - The connection to run on.
 * @param migrations - The migrations, in the order to apply them.
 * @returns The versions the run applied.
 */
export const migrate = (
  executor: Executor,
  migrations: readonly Migration[],
): Promise<string[]> =>
  executor.transaction(async (tx) => {
    await tx.query(ACQUIRE, [LOCK]);
    await tx.exec(CREATE);

    const checksums = await applied(tx);
    compare(checksums, migrations);

    const done: string[] = [];
    for (const migration of migrations) {
      if (!checksums.has(migration.version)) {
        await apply(tx, migration);
        done.push(migration.version);
      }
    }
    return done;
  });
