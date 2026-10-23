import { createServer } from "node:net";

import { pglite } from "@bezoar/pglite";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
 * The socket server serves one connection at a time, so each executor here
 * has a pool of one and is closed before the next connects.
 */
const client = new PGlite();
const hermetic = pglite(client);
let server: PGLiteSocketServer;
let port: number;

const connect = (role?: string) =>
  pg(
    { host: "127.0.0.1", port, database: "postgres", user: "postgres", max: 1 },
    { role },
  );

beforeAll(async () => {
  port = await free();
  server = new PGLiteSocketServer({ db: client, port, host: "127.0.0.1" });
  await server.start();
  await hermetic.exec(`
    CREATE ROLE web NOLOGIN;
    CREATE TABLE events (
      id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      title text NOT NULL,
      status text NOT NULL DEFAULT 'draft'
    );
    INSERT INTO events (title, status) VALUES ('Worship', 'published'), ('Draft', 'draft');
    GRANT SELECT ON events TO web;
    ALTER TABLE events ENABLE ROW LEVEL SECURITY;
    CREATE POLICY published ON events FOR SELECT TO web USING (status = 'published');
  `);
});

afterAll(async () => {
  await server.stop();
  await hermetic.close();
});

describe("an executor with a role", () => {
  it("runs as the role on each connection, inside and outside a transaction", async () => {
    const web = connect("web");
    try {
      expect((await web.query("SELECT current_user AS who", [])).rows).toEqual([
        { who: "web" },
      ]);
      expect(
        (await web.query("SELECT title FROM events ORDER BY id", [])).rows,
      ).toEqual([{ title: "Worship" }]);
      await expect(
        web.query("UPDATE events SET title = $1 WHERE id = 1", ["Changed"]),
      ).rejects.toThrow("permission denied");
      await web.transaction(async (tx) => {
        expect((await tx.query("SELECT current_user AS who", [])).rows).toEqual(
          [{ who: "web" }],
        );
      });
    } finally {
      await web.close();
    }
  });
});

/**
 * A fake pool: each `connect` hands out a client that records its queries,
 * and `SET ROLE` of a role that does not exist fails.
 */
const fakePool = () => {
  const clients: { queries: string[]; released: unknown[] }[] = [];
  const make = () => {
    const client = { queries: [] as string[], released: [] as unknown[] };
    clients.push(client);
    return {
      query: async (text: string | { text: string }) => {
        const sql = typeof text === "string" ? text : text.text;
        client.queries.push(sql);
        if (sql.startsWith('SET ROLE "nobody"')) {
          throw new Error('role "nobody" does not exist');
        }
        return { rows: [], rowCount: 0 };
      },
      release: (error?: unknown) => {
        client.released.push(error ?? null);
      },
    };
  };
  const idle: ReturnType<typeof make>[] = [];
  const pool = {
    connect: async () => {
      const client = idle.pop() ?? make();
      const release = client.release;
      client.release = (error?: unknown) => {
        release(error);
        if (error === undefined) {
          idle.push(client);
        }
      };
      return client;
    },
    query: async () => ({ rows: [], rowCount: 0 }),
    end: async () => {},
  };
  return { pool: pool as never, clients };
};

describe("the lease of a client", () => {
  it("takes the role once per client and keeps it", async () => {
    const { pool, clients } = fakePool();
    const web = pg(pool, { role: "web" });
    await web.query("SELECT 1", []);
    await web.query("SELECT 2", []);
    await web.transaction(async (tx) => {
      await tx.query("SELECT 3", []);
    });
    expect(clients).toHaveLength(1);
    const sets = clients[0]!.queries.filter((sql) =>
      sql.startsWith("SET ROLE"),
    );
    expect(sets).toEqual(['SET ROLE "web"']);
    expect(clients[0]!.queries[0]).toBe('SET ROLE "web"');
  });

  it("discards a client that cannot take the role and throws", async () => {
    const { pool, clients } = fakePool();
    const nobody = pg(pool, { role: "nobody" });
    await expect(nobody.query("SELECT 1", [])).rejects.toThrow(
      'role "nobody" does not exist',
    );
    expect(clients[0]!.released[0]).toBeInstanceOf(Error);
    expect(clients[0]!.queries).toEqual(['SET ROLE "nobody"']);
  });

  it("issues no SET ROLE without a role", async () => {
    const { pool, clients } = fakePool();
    const owner = pg(pool);
    await owner.transaction(async (tx) => {
      await tx.query("SELECT 1", []);
    });
    const ran = clients[0]!.queries.filter((sql) => !sql.includes("pg_type"));
    expect(ran).toEqual(["BEGIN", "SELECT 1", "COMMIT"]);
  });
});
