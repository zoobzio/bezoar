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
  "roles",
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

/**
 * The key of the advisory lock a roles run holds. Two runs against one
 * database wait for each other, as two migration runs do.
 */
export const ROLES_LOCK = 0x626f79;

/**
 * Whether a role exists in the cluster.
 */
export const EXISTS = "SELECT 1 FROM pg_roles WHERE rolname = $1";

/**
 * The schemas of the database other than the system ones: where a grant
 * reaches, and where a roles run revokes before it grants.
 */
export const SCHEMAS = `SELECT nspname FROM pg_namespace
  WHERE nspname NOT LIKE 'pg\\_%' AND nspname <> 'information_schema'
  ORDER BY nspname`;

/**
 * Quotes an identifier for SQL text: a role or a schema name.
 */
export const quote = (name: string): string =>
  `"${name.replaceAll('"', '""')}"`;

/**
 * Makes a role that cannot log in. A role of bezoar is a group: a login user
 * the deployment makes joins it with `IN ROLE`.
 */
export const DECLARE = (role: string): string =>
  `CREATE ROLE ${quote(role)} NOLOGIN`;

/**
 * Takes every privilege of a role on the objects of a schema, so that the
 * grant file of the role states the whole of them.
 */
export const REVOKE = (role: string, schema: string): string =>
  [
    `REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${quote(schema)} FROM ${quote(role)}`,
    `REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ${quote(schema)} FROM ${quote(role)}`,
    `REVOKE ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA ${quote(schema)} FROM ${quote(role)}`,
    `REVOKE ALL PRIVILEGES ON SCHEMA ${quote(schema)} FROM ${quote(role)}`,
  ].join(";\n");
