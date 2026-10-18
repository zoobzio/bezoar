import type { Issue } from "@bezoar/schema";

import { SchemaError } from "@bezoar/schema";

/**
 * Renders issues into a multi-line message, each prefixed by its path.
 */
const summarize = (issues: Issue[]): string =>
  issues
    .map((issue) =>
      issue.path.length
        ? `${issue.path.map(String).join(".")}: ${issue.message}`
        : issue.message,
    )
    .join("\n");

/**
 * Raised at construction when the SQL bundle does not match the contract: a
 * query without SQL, or SQL for a query the contract does not declare.
 * Carries the schema's issues.
 */
export class InvalidBundleError extends Error {
  readonly issues: Issue[];

  constructor(issues: Issue[]) {
    super(`@bezoar/core: the bundle is invalid —\n${summarize(issues)}`);
    this.name = "InvalidBundleError";
    this.issues = issues;
  }
}

/**
 * Raised when the arguments of a call do not fit the slots of the query.
 * Carries the query name and the schema's issues.
 */
export class InvalidArgumentsError extends Error {
  readonly query: string;
  readonly issues: Issue[];

  constructor(query: string, issues: Issue[]) {
    super(
      `@bezoar/core: the arguments of ${JSON.stringify(query)} are invalid —\n${summarize(issues)}`,
    );
    this.name = "InvalidArgumentsError";
    this.query = query;
    this.issues = issues;
  }
}

/**
 * Raised when a row the driver returned does not fit the columns of the
 * query, or the validator of a built query. Carries the query name, which
 * is `BUILT` for a built query, the index of the row, and the issues.
 */
export class InvalidRowError extends Error {
  readonly query: string;
  readonly index: number;
  readonly issues: Issue[];

  constructor(query: string, index: number, issues: Issue[]) {
    super(
      `@bezoar/core: row ${index} of ${JSON.stringify(query)} is invalid —\n${summarize(issues)}`,
    );
    this.name = "InvalidRowError";
    this.query = query;
    this.index = index;
    this.issues = issues;
  }
}

/**
 * Raised at construction when a query group takes the name of a member of
 * the service, such as `migrate` or `selectFrom`.
 */
export class ReservedQueryError extends Error {
  readonly query: string;

  constructor(query: string) {
    super(`@bezoar/core: ${JSON.stringify(query)} is reserved by the service`);
    this.name = "ReservedQueryError";
    this.query = query;
  }
}

/**
 * Raised at construction when a name is both a query and a group, as
 * `events` is when `events` and `events.list` are both queries.
 */
export class AmbiguousQueryError extends Error {
  readonly query: string;

  constructor(query: string) {
    super(`@bezoar/core: ${JSON.stringify(query)} is both a query and a group`);
    this.name = "AmbiguousQueryError";
    this.query = query;
  }
}

/**
 * Raised when the driver fails to run a query. Carries the query name, which
 * is `BUILT` for a built query, and the driver's error as `cause`.
 */
export class QueryError extends Error {
  readonly query: string;

  constructor(query: string, cause: unknown) {
    super(`@bezoar/core: ${JSON.stringify(query)} failed`, { cause });
    this.name = "QueryError";
    this.query = query;
  }
}

/**
 * Raised when a migration fails to apply. Carries the version and the
 * driver's error as `cause`. The run rolls back. No migration of the run is
 * kept.
 */
export class MigrationError extends Error {
  readonly version: string;

  constructor(version: string, cause: unknown) {
    super(`@bezoar/core: migration ${version} failed`, { cause });
    this.name = "MigrationError";
    this.version = version;
  }
}

/**
 * Raised when the database holds a migration that the list does not match:
 * the checksum changed, or the version is not in the list. The database and
 * the build disagree.
 */
export class MigrationDriftError extends Error {
  readonly version: string;

  constructor(version: string, reason: string) {
    super(`@bezoar/core: migration ${version} ${reason}`);
    this.name = "MigrationDriftError";
    this.version = version;
  }
}

/**
 * Raised when a seed fails to run. Carries the name and the driver's error
 * as `cause`. The transaction rolls back.
 */
export class SeedError extends Error {
  readonly seed: string;

  constructor(seed: string, cause: unknown) {
    super(`@bezoar/core: seed ${JSON.stringify(seed)} failed`, { cause });
    this.name = "SeedError";
    this.seed = seed;
  }
}

/**
 * Runs a schema check and rethrows its {@link SchemaError} as the error that
 * `frame` makes from the issues. Any other error propagates untouched.
 *
 * @param frame - Makes the core error from the issues.
 * @param run - The check.
 */
export const reframe = <R>(
  frame: (issues: Issue[]) => Error,
  run: () => R,
): R => {
  try {
    return run();
  } catch (error) {
    if (error instanceof SchemaError) {
      throw frame(error.issues);
    }
    throw error;
  }
};
