import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { pglite } from "../src/pglite";

const client = new PGlite();
const owner = pglite(client);
const web = pglite(client, { role: "web" });

beforeAll(async () => {
  await owner.exec(`
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

afterAll(() => owner.close());

describe("an executor with a role", () => {
  it("runs a query as the role, under its policies", async () => {
    const { rows } = await web.query(
      "SELECT title FROM events ORDER BY id",
      [],
    );
    expect(rows).toEqual([{ title: "Worship" }]);
    expect((await web.query("SELECT current_user AS who", [])).rows).toEqual([
      { who: "web" },
    ]);
  });

  it("is refused what the role may not do", async () => {
    await expect(
      web.query("UPDATE events SET title = $1 WHERE id = 1", ["Changed"]),
    ).rejects.toThrow("permission denied");
    await expect(web.exec("DELETE FROM events")).rejects.toThrow(
      "permission denied",
    );
  });

  it("keeps the role through a transaction and its savepoints", async () => {
    await web.transaction(async (tx) => {
      expect((await tx.query("SELECT current_user AS who", [])).rows).toEqual([
        { who: "web" },
      ]);
      await tx.transaction(async (inner) => {
        expect(
          (await inner.query("SELECT count(*)::int AS n FROM events", [])).rows,
        ).toEqual([{ n: 1 }]);
      });
    });
  });

  it("leaves an executor without a role over the same client as the owner", async () => {
    const { rows } = await owner.query("SELECT current_user AS who", []);
    expect(rows).toEqual([{ who: "postgres" }]);
    expect(
      (await owner.query("SELECT count(*)::int AS n FROM events", [])).rows,
    ).toEqual([{ n: 2 }]);
  });
});
