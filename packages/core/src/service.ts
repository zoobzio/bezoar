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
  Config,
  Executor,
  Grant,
  Options,
  Outcome,
  Scoping,
  Service,
  Validator,
} from "./types";

import { Kysely } from "kysely";
import { keys } from "objectively";

import { BUILT, RESERVED } from "./constant";
import { defineDialect } from "./dialect";
import {
  ForbiddenQueryError,
  InvalidArgumentsError,
  InvalidRowError,
  QueryError,
  UnknownRoleError,
  reframe,
} from "./error";
import { defineGroups } from "./groups";
import { migrate } from "./migrate";
import { declareRoles, roles } from "./roles";
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
 * The queries a service offers: those of its role, or every query of the
 * contract when it has no role.
 *
 * @throws UnknownRoleError when the contract has no such role.
 */
const scopeOf = <D extends Definition>(
  definition: D,
  role: string | undefined,
): readonly Query<D>[] => {
  if (role === undefined) {
    return keys(definition.queries);
  }
  const queries = definition.roles?.[role];
  if (queries === undefined) {
    throw new UnknownRoleError(role);
  }
  return queries as Query<D>[];
};

/**
 * Builds a {@link Bezoar} service over a container. A transaction builds
 * one over the executor of the transaction. The service inside a transaction
 * has the same surface as the one outside, with its own builder over the
 * executor of the transaction. A container with a role builds a service
 * over the queries of the role alone.
 */
export const defineService = <D extends Definition, R extends Scoping<D>>(
  definition: D,
  schema: Schema<D>,
  config: Config<D, R>,
  options: Options<D>,
): Bezoar<D, R> => {
  const names = scopeOf(definition, config.role);
  const offered = new Set<string>(names);

  /**
   * Checks that the service offers a query.
   *
   * @throws ForbiddenQueryError when the service is scoped to a role and the
   *   query is not one of its queries.
   */
  const admit = (query: Query<D>) => {
    if (config.role !== undefined && !offered.has(query)) {
      throw new ForbiddenQueryError(query, config.role);
    }
  };

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
    admit(query);
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
   * is given. The signatures are those of `Execute`.
   */
  async function executeAll<O>(query: Compilable<O>): Promise<O[]>;
  async function executeAll<O, R extends O>(
    query: Compilable<O>,
    row: Validator<R>,
  ): Promise<R[]>;
  async function executeAll(
    query: Compilable<unknown>,
    validator?: Validator<unknown>,
  ): Promise<unknown[]> {
    const { rows } = await built(query);
    return validator === undefined
      ? rows
      : rows.map((row, index) => proveWith(validator, index, row));
  }

  /**
   * Runs a built query and returns its first row, proven when a validator
   * is given, or `null` when it has none. The signatures are those of
   * `Execute`.
   */
  async function executeFirst<O>(query: Compilable<O>): Promise<O | null>;
  async function executeFirst<O, R extends O>(
    query: Compilable<O>,
    row: Validator<R>,
  ): Promise<R | null>;
  async function executeFirst(
    query: Compilable<unknown>,
    validator?: Validator<unknown>,
  ): Promise<unknown> {
    const { rows } = await built(query);
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return validator === undefined ? row : proveWith(validator, 0, row);
  }

  const transaction = <T>(fn: (tx: Bezoar<D, R>) => Promise<T>): Promise<T> =>
    config.executor.transaction((executor: Executor) =>
      fn(defineService(definition, schema, { ...config, executor }, options)),
    );

  const service: Service<D, R> = {
    config,
    schema,
    query: run,
    first: take,
    execute: Object.assign(executeAll, { first: executeFirst }),
    build: builder,
    transaction,
    migrate: (migrations) => migrate(config.executor, migrations),
    seed: (seeds) => seed(config.executor, seeds),
    roles: Object.assign(
      (grants: readonly Grant[]) => roles(config.executor, grants),
      {
        declare: (grants: readonly Grant[]) =>
          declareRoles(config.executor, grants),
      },
    ),
  };

  const groups = defineGroups<D>(names, new Set<string>(RESERVED), (query) => {
    const method = (args?: unknown) => run(query, args);
    return returnsRows(query)
      ? Object.assign(method, {
          first: (args?: unknown) => take(query, args),
        })
      : method;
  });

  return Object.assign(service, groups) as Bezoar<D, R>;
};
