import type {
  Definition,
  Query,
  Returns,
  Row,
  RowQuery,
  Schema,
  Slot,
} from "@bezoar/schema";

import type {
  Args,
  Bezoar,
  Config,
  Executor,
  Options,
  Outcome,
  Service,
} from "./types";

import { keys } from "objectively";

import { RESERVED } from "./constant";
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
 * Builds a {@link Bezoar} service over a container. A transaction builds
 * one over the executor of the transaction. The service inside a transaction
 * has the same surface as the one outside.
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

  const transaction = <T>(fn: (tx: Bezoar<D>) => Promise<T>): Promise<T> =>
    config.executor.transaction((executor: Executor) =>
      fn(defineService(definition, schema, { ...config, executor }, options)),
    );

  const service: Service<D> = {
    config,
    schema,
    query: run,
    first: take,
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

  return Object.assign(service, groups);
};
