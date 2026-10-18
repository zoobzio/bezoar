import type {
  Database,
  Definition,
  Query,
  Returns,
  Row,
  RowQuery,
  Schema,
  Slot,
} from "@bezoar/schema";
import type { Compilable, QueryResult } from "kysely";

import type {
  Args,
  Bezoar,
  Builder,
  Config,
  Execute,
  Executor,
  Options,
  Outcome,
  Service,
  Validator,
} from "./types";

import { Kysely } from "kysely";
import { keys } from "objectively";

import { BUILT, DELEGATED, RESERVED } from "./constant";
import { defineDialect } from "./dialect";
import {
  InvalidArgumentsError,
  InvalidRowError,
  QueryError,
  reframe,
} from "./error";
import { defineGroups } from "./groups";
import { migrate } from "./migrate";
import { seed } from "./seed";

/**
 * The value of each slot, in position order. An absent slot binds null.
 */
const bind = (
  slots: readonly Slot[],
  given: Record<string, unknown>,
): unknown[] => slots.map((slot) => given[slot.name] ?? null);

/**
 * A row as the driver returns it.
 */
type Raw = Record<string, unknown>;

/**
 * Whether a member of an object is a getter somewhere on its prototype
 * chain.
 */
const isGetter = (target: object, name: string): boolean => {
  for (
    let prototype: unknown = Object.getPrototypeOf(target);
    prototype !== null && prototype !== undefined;
    prototype = Object.getPrototypeOf(prototype)
  ) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
    if (descriptor !== undefined) {
      return typeof descriptor.get === "function";
    }
  }
  return false;
};

/**
 * The delegated members of a builder. A method is bound so it reads the
 * builder it came from. A getter, such as `fn`, is read once: what it
 * returns is a module of its own, with members of its own, and is not
 * bound.
 */
const delegate = <D extends Definition>(
  builder: Kysely<Database<D>>,
): Builder<D> => {
  const members: Partial<Record<string, unknown>> = {};
  for (const name of DELEGATED) {
    const member: unknown = builder[name];
    members[name] =
      typeof member === "function" && !isGetter(builder, name)
        ? member.bind(builder)
        : member;
  }
  return members as Builder<D>;
};

/**
 * Builds a {@link Bezoar} service over a container. A transaction builds
 * one over the executor of the transaction. The service inside a transaction
 * has the same surface as the one outside, with its own builder over the
 * executor of the transaction.
 */
export const defineService = <D extends Definition>(
  definition: D,
  schema: Schema<D>,
  config: Config<D>,
  options: Options<D>,
): Bezoar<D> => {
  /**
   * Runs the SQL of a query on the executor of the container.
   *
   * @throws QueryError when the driver fails.
   */
  const execute = async (
    query: Query<D>,
    params: unknown[],
  ): Promise<Outcome> => {
    try {
      return await config.executor.query(config.queries[query], params);
    } catch (cause) {
      throw new QueryError(query, cause);
    }
  };

  /**
   * Proves a row of an outcome against the columns of the query.
   *
   * @throws InvalidRowError when the row does not fit.
   */
  const prove = (query: Query<D>, index: number, row: unknown) =>
    reframe(
      (issues) => new InvalidRowError(query, index, issues),
      () => schema.assert.row(query, row),
    );

  /**
   * Proves the arguments of a call, binds them, runs the query, and reports
   * it. What `run` and `take` share.
   *
   * @throws InvalidArgumentsError when the arguments do not fit the slots.
   */
  const perform = async (query: Query<D>, args: unknown): Promise<Outcome> => {
    const statement = definition.queries[query]!;
    const given: Record<string, unknown> = reframe(
      (issues) => new InvalidArgumentsError(query, issues),
      () => schema.parse.arguments(query, args),
    );

    const started = performance.now();
    const outcome = await execute(query, bind(statement.slots, given));
    options.onQuery?.({
      query,
      sql: config.queries[query],
      arguments: args,
      ms: performance.now() - started,
      count: outcome.count,
    });
    return outcome;
  };

  /**
   * Whether a query returns rows: it has a column.
   */
  const returnsRows = (query: Query<D>): boolean =>
    definition.queries[query]!.columns.length > 0;

  /**
   * Runs one query and returns its rows, or its count when it has no
   * column. The first signature is the typed call. The second is the untyped
   * call that the groups make.
   */
  async function run<Q extends Query<D>>(
    query: Q,
    ...args: Args<D, Q>
  ): Promise<Returns<D, Q>>;
  async function run(query: Query<D>, args?: unknown): Promise<unknown>;
  async function run(query: Query<D>, args: unknown = {}): Promise<unknown> {
    const outcome = await perform(query, args);
    if (!returnsRows(query)) {
      return outcome.count;
    }
    for (const [index, row] of outcome.rows.entries()) {
      prove(query, index, row);
    }
    return outcome.rows;
  }

  /**
   * Runs one query and returns its first row, or `null` when it has none.
   * Proves the row it returns and no other.
   */
  async function take<Q extends RowQuery<D>>(
    query: Q,
    ...args: Args<D, Q>
  ): Promise<Row<D, Q> | null>;
  async function take(query: Query<D>, args?: unknown): Promise<unknown>;
  async function take(query: Query<D>, args: unknown = {}): Promise<unknown> {
    const outcome = await perform(query, args);
    const row = outcome.rows[0];
    if (row === undefined) {
      return null;
    }
    prove(query, 0, row);
    return row;
  }

  const builder = new Kysely<Database<D>>({
    dialect: defineDialect(() => config.executor),
  });

  /**
   * Compiles a built query, runs it through the builder of the service, and
   * reports it.
   *
   * @throws QueryError when the driver fails.
   */
  const built = async (
    query: Compilable<unknown>,
  ): Promise<QueryResult<Raw>> => {
    const compiled = query.compile();
    const started = performance.now();
    let result: QueryResult<Raw>;
    try {
      result = await builder.executeQuery<Raw>(compiled);
    } catch (cause) {
      throw new QueryError(BUILT, cause);
    }
    options.onQuery?.({
      query: BUILT,
      sql: compiled.sql,
      arguments: compiled.parameters,
      ms: performance.now() - started,
      count: Number(result.numAffectedRows ?? result.rows.length),
    });
    return result;
  };

  /**
   * Proves a row of a built query against a validator and returns its
   * output.
   *
   * @throws InvalidRowError when the row does not fit.
   */
  const proveWith = (
    validator: Validator<unknown>,
    index: number,
    row: unknown,
  ): unknown => {
    const result = validator.safeParse(row);
    if (!result.success) {
      throw new InvalidRowError(BUILT, index, result.error.issues);
    }
    return result.data;
  };

  /**
   * Runs a built query and returns its rows, each proven when a validator
   * is given. The typed signatures are on {@link Execute}.
   */
  const executeAll = async (
    query: Compilable<unknown>,
    validator?: Validator<unknown>,
  ): Promise<unknown[]> => {
    const { rows } = await built(query);
    return validator === undefined
      ? rows
      : rows.map((row, index) => proveWith(validator, index, row));
  };

  /**
   * Runs a built query and returns its first row, proven when a validator
   * is given, or `null` when it has none.
   */
  const executeFirst = async (
    query: Compilable<unknown>,
    validator?: Validator<unknown>,
  ): Promise<unknown> => {
    const { rows } = await built(query);
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return validator === undefined ? row : proveWith(validator, 0, row);
  };

  const transaction = <T>(fn: (tx: Bezoar<D>) => Promise<T>): Promise<T> =>
    config.executor.transaction((executor: Executor) =>
      fn(defineService(definition, schema, { ...config, executor }, options)),
    );

  const service: Service<D> = {
    config,
    schema,
    query: run,
    first: take,
    // The untyped functions carry the typed signatures of Execute.
    execute: Object.assign(executeAll, { first: executeFirst }) as Execute,
    build: builder,
    transaction,
    migrate: (migrations) => migrate(config.executor, migrations),
    seed: (seeds) => seed(config.executor, seeds),
  };

  const groups = defineGroups<D>(
    keys(definition.queries),
    new Set<string>(RESERVED),
    (query) => {
      const method = (args?: unknown) => run(query, args);
      return returnsRows(query)
        ? Object.assign(method, {
            first: (args?: unknown) => take(query, args),
          })
        : method;
    },
  );

  return Object.assign(service, delegate(builder), groups);
};
