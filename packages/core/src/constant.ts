/**
 * The members of a service. A query group cannot take one of these names.
 */
export const RESERVED = [
  "config",
  "schema",
  "query",
  "first",
  "execute",
  "build",
  "transaction",
  "migrate",
  "seed",
] as const;

/**
 * The query name a report carries for a built query: one that ran through
 * the builder rather than the contract. The name of the builder member of
 * the service. No query of a contract has this name, as it is reserved.
 */
export const BUILT = "build";

/**
 * The table that records each applied migration: its version, its name, its
 * checksum, and when it was applied.
 */
export const TABLE = "bezoar_migrations";

/**
 * The key of the advisory lock a migration run holds. Two runs against one
 * database wait for each other.
 */
export const LOCK = 0x626f78;

/**
 * Takes the advisory lock for the rest of the transaction.
 */
export const ACQUIRE = "SELECT pg_advisory_xact_lock($1)";

/**
 * Makes the tracking table when the database lacks it.
 */
export const CREATE = `CREATE TABLE IF NOT EXISTS ${TABLE} (
  version text PRIMARY KEY,
  name text NOT NULL,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
)`;

/**
 * Reads the version and the checksum of each applied migration.
 */
export const APPLIED = `SELECT version, checksum FROM ${TABLE} ORDER BY version`;

/**
 * Records one applied migration.
 */
export const RECORD = `INSERT INTO ${TABLE} (version, name, checksum) VALUES ($1, $2, $3)`;
