import type { Grant, Migration, Seed } from "@bezoar/core";
import type { Definition, TableKind } from "@bezoar/schema";

/**
 * The authored `bezoar.config.ts`: where the SQL lives and where the build
 * writes. Every path is relative to the project root.
 */
export interface KitConfig {
  /**
   * The directory of migrations. The files apply in name order, and the
   * name of a file is its version. Defaults to `src/migrations`.
   */
  migrations?: string;

  /**
   * The directory of seeds. Each file is `<name>.sql`, and the files run in
   * name order. Defaults to `src/seeds`.
   */
  seeds?: string;

  /**
   * The directory of queries. Each file is one query, named for its path.
   * Defaults to `src/queries`.
   */
  queries?: string;

  /**
   * The directory of roles. Each file is `<role>.sql`: the grants of the
   * role. Defaults to `src/roles`.
   */
  roles?: string;

  /**
   * The output directory. Defaults to `bezoar`.
   */
  outDir?: string;
}

/**
 * A config through validation: every default applied, every path normalized.
 */
export interface Settings {
  migrations: string;
  seeds: string;
  queries: string;
  roles: string;
  outDir: string;
}

/**
 * A migration as the kit read it: the migration, and the file it came from.
 */
export interface MigrationFile extends Migration {
  /** The path of the file, relative to the project root. */
  readonly path: string;
}

/**
 * A seed as the kit read it: the seed, and the file it came from.
 */
export interface SeedFile extends Seed {
  /** The path of the file, relative to the project root. */
  readonly path: string;
}

/**
 * A grant as the kit read it: the grant, and the file it came from. The
 * file is named for its role: `web.sql` is the grant of `web`.
 */
export interface GrantFile extends Grant {
  /** The path of the file, relative to the project root. */
  readonly path: string;
}

/**
 * A query as the kit read it: its name, its SQL with the slots rewritten to
 * positions, and the slots in position order.
 */
export interface Query {
  /** The name, from the path of the file: `events/list.sql` is `events.list`. */
  readonly name: string;

  /** The SQL, with `$1` in place of the first slot, and so on. */
  readonly sql: string;

  /** The slot names, in position order. */
  readonly slots: readonly string[];

  /** The path of the file, relative to the project root. */
  readonly path: string;
}

/**
 * The SQL of a project, as the kit read it.
 */
export interface Sources {
  /** The migrations, in file name order. */
  migrations: MigrationFile[];

  /** The seeds, in file name order. */
  seeds: SeedFile[];

  /** The queries, in file name order. */
  queries: Query[];

  /** The grants, in file name order. */
  roles: GrantFile[];
}

/**
 * What Postgres, SafeQL, and the parse tree say about one query: the type
 * OID and nullability of each slot, and the name, type OID, and nullability
 * of each column.
 */
export interface Described {
  readonly params: readonly {
    readonly type: number;
    readonly nullable: boolean;
  }[];
  readonly columns: readonly {
    readonly name: string;
    readonly type: number;
    readonly nullable: boolean;
  }[];
}

/**
 * The enums of the database after the migrations ran: each enum type with
 * its labels, in declaration order. What the contract carries as `enums`.
 */
export type Enums = Readonly<Record<string, readonly string[]>>;

/**
 * The queries each role may run, by role, in query name order: those the
 * hermetic database let the role plan after the grants were applied. What
 * the contract carries as `roles`.
 */
export type Roles = Readonly<Record<string, readonly string[]>>;

/**
 * A table or a view of the database after the migrations ran, as the kit
 * read it: where it lives, whether the search path finds it, and its
 * columns in declaration order, each with its type OID, whether it takes
 * null, and whether the database can fill it.
 */
export interface Relation {
  readonly schema: string;
  readonly name: string;
  readonly kind: TableKind;
  readonly visible: boolean;
  readonly columns: {
    readonly name: string;
    readonly type: number;
    readonly nullable: boolean;
    readonly generated: boolean;
  }[];
}

/**
 * The columns of each table of the database after the migrations ran, in
 * declaration order, with whether each takes null. A table is keyed by
 * `schema.name`, and by its bare name when the search path finds it. What
 * decides the nullability of a slot a query writes into a column.
 */
export type Columns = ReadonlyMap<
  string,
  readonly { readonly name: string; readonly nullable: boolean }[]
>;

/**
 * One file of the output.
 */
export interface OutputFile {
  /** The path, relative to the output directory. */
  path: string;

  /** The text of the file. */
  contents: string;
}

/**
 * What a build produces: the files to write, and what they were made from.
 */
export interface Output {
  /** The output directory, normalized and relative to the project root. */
  outDir: string;

  /** The files of the output. */
  files: OutputFile[];

  /** The SQL the build read. */
  sources: Sources;

  /** The enums of the hermetic database after the migrations ran. */
  enums: Enums;

  /** The contract: every query with its slots and columns typed. */
  contract: Definition;
}

/**
 * The options of a build: where the project lives.
 */
export interface BuildOptions {
  /** The project root. Defaults to `process.cwd()`. */
  root?: string;

  /** The config file, relative to the root. Defaults to `bezoar.config.ts`. */
  config?: string;
}
