/**
 * Raised when there is no config file at the path the build was pointed at.
 * Carries the `path` it looked for.
 */
export class MissingConfigError extends Error {
  readonly path: string;

  constructor(path: string) {
    super(`@bezoar/kit: no config file at ${path}`);
    this.name = "MissingConfigError";
    this.path = path;
  }
}

/**
 * Raised when a config file does not default-export a config. Carries the
 * `path` of the file.
 */
export class MalformedConfigError extends Error {
  readonly path: string;

  constructor(path: string) {
    super(
      `@bezoar/kit: ${path} must default-export a config (defineConfig({ … }))`,
    );
    this.name = "MalformedConfigError";
    this.path = path;
  }
}

/**
 * Raised when a config breaks the rules of the kit, such as a directory
 * outside the project root. Carries every issue found. Thrown before any
 * file is read.
 */
export class InvalidConfigError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    const lines = issues.map((issue) => `  ${issue}`).join("\n");
    super(`@bezoar/kit: the config is invalid —\n${lines}`);
    this.name = "InvalidConfigError";
    this.issues = issues;
  }
}

/**
 * Raised when Postgres rejects the SQL of a source file. Carries the `path`
 * of the file, relative to the project root, and the error of Postgres as
 * `cause`.
 */
export class InvalidSourceError extends Error {
  readonly path: string;

  constructor(path: string, reason: string, options?: ErrorOptions) {
    super(`@bezoar/kit: ${path} ${reason}`, options);
    this.name = "InvalidSourceError";
    this.path = path;
  }
}

/**
 * Raised when a query cannot be built: a path that does not name a query, a
 * file without SQL, a slot the SQL cannot type, SQL that Postgres rejects,
 * or a column of a type the type table does not have. Carries the `path` of
 * the file, relative to the project root.
 */
export class InvalidQueryError extends Error {
  readonly path: string;

  constructor(path: string, reason: string, options?: ErrorOptions) {
    super(`@bezoar/kit: ${path} ${reason}`, options);
    this.name = "InvalidQueryError";
    this.path = path;
  }
}
