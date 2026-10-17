import type { z } from "zod";

import type { SCALARS } from "./constant";

/**
 * The JavaScript type for each scalar type of the table. The kit emits these
 * types. The validators check them. A driver parses the text of Postgres to
 * them.
 *
 * - `int8` is a `number`. A value outside the safe integer range fails
 *   validation.
 * - `numeric` is a `string`. No digit is lost.
 * - `timestamptz` is a `Date`. The other temporal types are strings, as
 *   Postgres writes them.
 * - `json` and `jsonb` are `unknown`. The caller parses them.
 */
export interface Scalars {
  bool: boolean;
  int2: number;
  int4: number;
  int8: number;
  float4: number;
  float8: number;
  numeric: string;
  text: string;
  varchar: string;
  bpchar: string;
  uuid: string;
  date: string;
  time: string;
  timetz: string;
  timestamp: string;
  timestamptz: Date;
  interval: string;
  json: unknown;
  jsonb: unknown;
  bytea: Uint8Array;
}

/**
 * The name of a scalar type of the table.
 */
export type Scalar = (typeof SCALARS)[number];

/**
 * A slot of a query: a named parameter of the SQL. `name` is the name in the
 * source. `type` is a {@link Type}. `nullable` is `true` when the SQL treats
 * a null as meaningful, for example as the operand of `IS NULL`. The slots
 * of a statement are in position order. The slot at index `i` binds `$i+1`.
 */
export interface Slot {
  readonly name: string;
  readonly type: string;
  readonly nullable: boolean;
}

/**
 * A column of a result: a field of each row. `name` is the name or the alias
 * in the SQL. `type` is a {@link Type}. `nullable` is `true` when a value of
 * the column can be null.
 */
export interface Column {
  readonly name: string;
  readonly type: string;
  readonly nullable: boolean;
}

/**
 * A statement: one query of the contract. The slots and the columns. A
 * statement with no column returns no rows: a write without `RETURNING`.
 * The statement holds no SQL. The SQL is in the queries bundle, by the same
 * name.
 */
export interface Statement {
  readonly slots: readonly Slot[];
  readonly columns: readonly Column[];
}

/**
 * A contract as `@bezoar/kit` builds it. `enums` maps each enum type of the
 * database to its labels, in declaration order. `queries` maps each query
 * name to its statement. The contract is plain data. The types of the
 * arguments and the rows derive from it. See {@link Arguments} and
 * {@link Row}.
 */
export interface Definition {
  readonly enums: Readonly<Record<string, readonly string[]>>;
  readonly queries: Readonly<Record<string, Statement>>;
}

/**
 * The name of a query in a contract, as in `events.list`.
 */
export type Query<D extends Definition> = keyof D["queries"] & string;

/**
 * The name of a query that returns rows: one with a column. A call of one
 * can take the first row. See {@link Returns}.
 */
export type RowQuery<D extends Definition> = {
  [Q in Query<D>]: [Columns<D, Q>] extends [never] ? never : Q;
}[Query<D>];

/**
 * The name of an enum type in a contract.
 */
export type Enum<D extends Definition> = keyof D["enums"] & string;

/**
 * A label of the enum type `E` in a contract.
 */
export type Label<
  D extends Definition,
  E extends Enum<D>,
> = D["enums"][E][number];

/**
 * A type that is not an array: a scalar type or an enum type of the contract.
 */
export type Base<D extends Definition> = Scalar | Enum<D>;

/**
 * A type that a slot or a column can have: a {@link Base} or an array of one.
 */
export type Type<D extends Definition> = Base<D> | `${Base<D>}[]`;

/**
 * The JavaScript type for a type name of a contract. A scalar maps through
 * {@link Scalars}. An enum maps to the union of its labels. An array maps to
 * an array of its element type. An element of an array can be null. A name
 * the contract does not know is `unknown`.
 */
export type Value<
  D extends Definition,
  T extends string,
> = T extends `${infer E}[]`
  ? (Value<D, E> | null)[]
  : T extends Scalar
    ? Scalars[T]
    : T extends Enum<D>
      ? Label<D, T>
      : unknown;

/**
 * Flattens an intersection into one object type.
 */
type Flat<T> = { [K in keyof T]: T[K] } & {};

/**
 * The slots of the query `Q`, as a union.
 */
type Slots<
  D extends Definition,
  Q extends Query<D>,
> = D["queries"][Q]["slots"][number];

/**
 * The columns of the query `Q`, as a union.
 */
type Columns<
  D extends Definition,
  Q extends Query<D>,
> = D["queries"][Q]["columns"][number];

/**
 * A field that the SQL treats as nullable.
 */
type Nullable = { readonly nullable: true };

/**
 * The arguments of the query `Q`: one member for each slot, by name. A
 * required slot takes its value. A nullable slot is optional and also takes
 * `null`. A query with no slot takes an empty object.
 */
export type Arguments<D extends Definition, Q extends Query<D>> = Flat<
  {
    [S in Exclude<Slots<D, Q>, Nullable> as S["name"]]: Value<D, S["type"]>;
  } & {
    [S in Extract<Slots<D, Q>, Nullable> as S["name"]]?: Value<
      D,
      S["type"]
    > | null;
  }
>;

/**
 * A row of the query `Q`: one member for each column, by name. A nullable
 * column also holds `null`.
 */
export type Row<D extends Definition, Q extends Query<D>> = {
  [C in Columns<D, Q> as C["name"]]: C extends Nullable
    ? Value<D, C["type"]> | null
    : Value<D, C["type"]>;
};

/**
 * What a call of the query `Q` returns, by its columns. A query with a
 * column returns its rows. A query with no column returns the count of the
 * rows the statement changed.
 */
export type Returns<D extends Definition, Q extends Query<D>> = [
  Columns<D, Q>,
] extends [never]
  ? number
  : Row<D, Q>[];

/**
 * The SQL of a contract: the text of each query, by name, with the slots
 * rewritten to positions. `@bezoar/kit` builds the bundle beside the
 * definition. The bundle holds every query of the definition and no other.
 */
export type Bundle<D extends Definition> = {
  readonly [Q in Query<D>]: string;
};

/**
 * A validation failure, as zod reports it. `code` identifies the failure.
 * `message` is readable text. `path` holds the keys from the root to the
 * failure.
 */
export type Issue = z.core.$ZodIssue;

/**
 * The zod schemas of a contract. `definition` checks a complete contract.
 * `query` checks a query name. `bundle` checks the SQL bundle. Each query
 * has a schema for its `arguments` and a schema for its `row`. `z.infer` of
 * a schema is the type that derives from the definition.
 */
export type Validators<D extends Definition> = {
  definition: z.ZodType<Definition>;
  query: z.ZodType<Query<D>>;
  bundle: z.ZodType<Bundle<D>>;
  queries: {
    [Q in Query<D>]: {
      arguments: z.ZodType<Arguments<D, Q>>;
      row: z.ZodType<Row<D, Q>>;
    };
  };
};

/**
 * A boolean type predicate for each kind. A `true` result narrows the value to
 * the type of the kind. Use {@link Assert} or {@link Parse} to get the issues.
 */
export type Check<D extends Definition> = {
  definition: (v: unknown) => v is Definition;
  query: (v: unknown) => v is Query<D>;
  bundle: (v: unknown) => v is Bundle<D>;
  arguments: <Q extends Query<D>>(query: Q, v: unknown) => v is Arguments<D, Q>;
  row: <Q extends Query<D>>(query: Q, v: unknown) => v is Row<D, Q>;
};

/**
 * An assertion function for each kind. The function returns when the value is
 * valid for the kind. The function throws a {@link SchemaError} with every
 * {@link Issue} when the value is not valid.
 */
export type Assert<D extends Definition> = {
  definition: (v: unknown) => asserts v is Definition;
  query: (v: unknown) => asserts v is Query<D>;
  bundle: (v: unknown) => asserts v is Bundle<D>;
  arguments: <Q extends Query<D>>(
    query: Q,
    v: unknown,
  ) => asserts v is Arguments<D, Q>;
  row: <Q extends Query<D>>(query: Q, v: unknown) => asserts v is Row<D, Q>;
};

/**
 * A parse function for each kind. The function returns the value narrowed to
 * the type of the kind. The {@link SchemaError} from {@link Assert} propagates
 * to the caller.
 */
export type Parse<D extends Definition> = {
  definition: (v: unknown) => Definition;
  query: (v: unknown) => Query<D>;
  bundle: (v: unknown) => Bundle<D>;
  arguments: <Q extends Query<D>>(query: Q, v: unknown) => Arguments<D, Q>;
  row: <Q extends Query<D>>(query: Q, v: unknown) => Row<D, Q>;
};

/**
 * The outcome of an {@link Inspect}. A success result holds the value narrowed
 * to the type of the kind. A failure result holds the {@link Issue}s.
 */
export type Result<V> =
  | {
      success: true;
      data: V;
    }
  | {
      success: false;
      issues: Issue[];
    };

/**
 * An inspect function for each kind. The function returns a {@link Result}. A
 * success result holds the narrowed value. A failure result holds the issues.
 */
export type Inspect<D extends Definition> = {
  definition: (v: unknown) => Result<Definition>;
  query: (v: unknown) => Result<Query<D>>;
  bundle: (v: unknown) => Result<Bundle<D>>;
  arguments: <Q extends Query<D>>(
    query: Q,
    v: unknown,
  ) => Result<Arguments<D, Q>>;
  row: <Q extends Query<D>>(query: Q, v: unknown) => Result<Row<D, Q>>;
};

/**
 * The bundle that {@link defineSchema} returns for a contract. The bundle has
 * the base definition and the zod {@link Validators} built from it. The
 * {@link Check}, {@link Assert}, {@link Parse}, and {@link Inspect} bundles
 * run the validators.
 */
export type Schema<D extends Definition> = {
  base: D;
  validators: Validators<D>;
  check: Check<D>;
  assert: Assert<D>;
  parse: Parse<D>;
  inspect: Inspect<D>;
};
