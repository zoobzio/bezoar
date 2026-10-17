import type { PGlite } from "@electric-sql/pglite";

import type { Described, Query } from "./types";

import { createServer } from "node:net";

import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { createGenerator } from "@ts-safeql/generate";
import postgres from "postgres";

import { CACHE, DATABASE, HOST } from "./constant";
import { InvalidQueryError } from "./error";

/**
 * What SafeQL answers a query with.
 */
type Generated = Awaited<
  ReturnType<ReturnType<typeof createGenerator>["generate"]>
>;

/**
 * The typed description of a result SafeQL builds, by column.
 */
type Target = NonNullable<
  Extract<Generated, { _tag: "Right" }>["right"]["output"]
>["value"][number][1];

/**
 * A port no process listens on.
 */
const free = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, HOST, () => {
      const address = server.address();
      server.close(() => {
        if (address === null || typeof address === "string") {
          reject(new Error("@bezoar/kit: no free port"));
        } else {
          resolve(address.port);
        }
      });
    });
    server.on("error", reject);
  });

/**
 * Whether a target admits null: it is `null`, or a union with `null` in it.
 */
const admitsNull = (target: Target): boolean => {
  if (target.kind === "type") {
    return target.type === "null";
  }
  if (target.kind === "union") {
    return target.value.some(admitsNull);
  }
  return false;
};

/**
 * Describes every query of a build against the hermetic database. The
 * database is served on a local port for the time of the call. SafeQL
 * describes each query through postgres.js and reports the nullability of
 * each column. The type of each slot and each column comes from the describe
 * of Postgres.
 *
 * @param client - The PGlite instance the migrations ran on.
 * @param queries - The queries to describe.
 * @returns The description of each query, by name.
 * @throws InvalidQueryError, with the error of Postgres as `cause`, when a
 *   query does not describe, or when two of its columns share a name.
 */
export const describeQueries = async (
  client: PGlite,
  queries: readonly Query[],
): Promise<Map<string, Described>> => {
  const described = new Map<string, Described>();
  if (queries.length === 0) {
    return described;
  }

  const port = await free();
  const server = new PGLiteSocketServer({ db: client, port, host: HOST });
  await server.start();
  const sql = postgres({
    host: HOST,
    port,
    database: DATABASE,
    username: DATABASE,
    max: 1,
    onnotice: () => {},
  });
  const { generate } = createGenerator();

  try {
    for (const query of queries) {
      const result = await generate({
        sql,
        query: { text: query.sql, sourcemaps: [] },
        cacheKey: CACHE,
        fieldTransform: undefined,
      });
      if (result._tag === "Left") {
        throw new InvalidQueryError(
          query.path,
          `failed: ${result.left.message}`,
          { cause: result.left },
        );
      }
      const { stmt, output } = result.right;
      const targets = new Map(output?.value ?? []);
      described.set(query.name, {
        params: stmt.types,
        columns: stmt.columns.map((column) => {
          const target = targets.get(column.name);
          return {
            name: column.name,
            type: column.type,
            nullable: target === undefined || admitsNull(target),
          };
        }),
      });
    }
  } finally {
    await sql.end({ timeout: 1 });
    await server.stop();
  }
  return described;
};
