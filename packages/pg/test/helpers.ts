import type { PgExecutor } from "../src/types";

import { createServer } from "node:net";

import { pglite } from "@bezoar/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PGlite } from "@electric-sql/pglite";

import { pg } from "../src/pg";

/** A port no process listens on. */
const free = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address === null || typeof address === "string") {
          reject(new Error("no free port"));
        } else {
          resolve(address.port);
        }
      });
    });
    server.on("error", reject);
  });

/**
 * A Postgres for the tests: PGlite in memory, served on a local port, with a
 * pg executor of one connection over it.
 */
export interface Served {
  executor: PgExecutor;
  stop: () => Promise<void>;
}

export const serve = async (): Promise<Served> => {
  const client = new PGlite();
  const hermetic = pglite(client);
  const port = await free();
  const server = new PGLiteSocketServer({
    db: client,
    port,
    host: "127.0.0.1",
  });
  await server.start();
  const executor = pg({
    host: "127.0.0.1",
    port,
    database: "postgres",
    user: "postgres",
    max: 1,
  });
  return {
    executor,
    stop: async () => {
      await executor.close();
      await server.stop();
      await hermetic.close();
    },
  };
};
