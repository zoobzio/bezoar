import type { Definition } from "@bezoar/schema";

import type { OutputFile, Sources } from "./types";

import { json, literal, pair } from "./print";

/**
 * The root module: the contract and the `isQuery` guard. The declaration
 * carries the contract as literal types, so the types of the arguments and
 * the rows derive from it. The module holds no SQL.
 */
const index = (contract: Definition): OutputFile[] =>
  pair(
    "index",
    [
      `export const contract = Object.freeze(${json(contract)});`,
      "const known = new Set(Object.keys(contract.queries));",
      `export const isQuery = (value) => typeof value === "string" && known.has(value);`,
    ],
    [
      `export declare const contract: ${literal(contract)};`,
      "export type Contract = typeof contract;",
      'export type Query = keyof Contract["queries"] & string;',
      "export declare const isQuery: (value: unknown) => value is Query;",
    ],
  );

/**
 * The queries module: the SQL of each query, by name, with the slots at
 * their positions. What the service runs.
 */
const bundle = (sources: Sources): OutputFile[] => {
  const sql: Record<string, string> = {};
  for (const query of sources.queries) {
    sql[query.name] = query.sql;
  }
  return pair(
    "queries",
    [`export const queries = Object.freeze(${json(sql)});`],
    [
      'import type { Query } from "./index.mjs";',
      "export declare const queries: Readonly<Record<Query, string>>;",
    ],
  );
};

/**
 * The migrations module: each migration as data, in file name order, for
 * the runner of `@bezoar/core`.
 */
const migrations = (sources: Sources): OutputFile[] => {
  const entries = sources.migrations.map(
    ({ version, name, sql, checksum }) => ({
      version,
      name,
      sql,
      checksum,
    }),
  );
  return pair(
    "migrations",
    [`export const migrations = Object.freeze(${json(entries)});`],
    [
      "export declare const migrations: readonly {",
      "  readonly version: string;",
      "  readonly name: string;",
      "  readonly sql: string;",
      "  readonly checksum: string;",
      "}[];",
    ],
  );
};

/**
 * The seeds module: each seed as data, in file name order.
 */
const seeds = (sources: Sources): OutputFile[] => {
  const entries = sources.seeds.map(({ name, sql }) => ({ name, sql }));
  return pair(
    "seeds",
    [`export const seeds = Object.freeze(${json(entries)});`],
    [
      "export declare const seeds: readonly {",
      "  readonly name: string;",
      "  readonly sql: string;",
      "}[];",
    ],
  );
};

/**
 * The roles module: each grant as data, in file name order, for the roles
 * runner of `@bezoar/core`.
 */
const roles = (sources: Sources): OutputFile[] => {
  const entries = sources.roles.map(({ role, sql }) => ({ role, sql }));
  return pair(
    "roles",
    [`export const roles = Object.freeze(${json(entries)});`],
    [
      "export declare const roles: readonly {",
      "  readonly role: string;",
      "  readonly sql: string;",
      "}[];",
    ],
  );
};

/**
 * The files of a build: the contract, the SQL, the migrations, the seeds,
 * and the roles as modules.
 *
 * @param sources - The SQL the build read.
 * @param contract - The contract of the build.
 */
export const emit = (sources: Sources, contract: Definition): OutputFile[] => [
  ...index(contract),
  ...bundle(sources),
  ...migrations(sources),
  ...seeds(sources),
  ...roles(sources),
];
