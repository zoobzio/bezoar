import { pglite } from "@bezoar/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { apply } from "../src/apply";
import { readEnums } from "../src/enums";
import { InvalidSourceError } from "../src/error";
import { readSources } from "../src/read";
import { FIXTURE } from "./helpers";

const settings = {
  migrations: "src/migrations",
  seeds: "src/seeds",
  queries: "src/queries",
  outDir: ".output",
};

const executor = pglite();

beforeAll(async () => {
  await apply(executor, await readSources(FIXTURE, settings));
});

afterAll(() => executor.close());

describe("apply", () => {
  it("applies the migrations and the seeds", async () => {
    const { rows } = await executor.query("SELECT slug FROM events", []);
    expect(rows).toEqual([{ slug: "worship" }]);
  });

  it("names the file that Postgres rejects, with its error as the cause", async () => {
    const failing = pglite();
    const sources = {
      migrations: [
        {
          path: "src/migrations/0001_bad.sql",
          version: "0001",
          name: "bad",
          sql: "CREATE TABLE t (id nosuchtype);",
          checksum: "x",
        },
      ],
      seeds: [],
      queries: [],
    };
    const error = apply(failing, sources);
    await expect(error).rejects.toThrow(InvalidSourceError);
    await expect(error).rejects.toThrow(/0001_bad\.sql failed: .*nosuchtype/);
    await failing.close();
  });
});

describe("readEnums", () => {
  it("reads each enum with its labels in order", async () => {
    await expect(readEnums(executor)).resolves.toEqual({
      event_day: ["sunday", "monday", "tuesday"],
    });
  });

  it("reads none from a database without an enum", async () => {
    const empty = pglite();
    await expect(readEnums(empty)).resolves.toEqual({});
    await empty.close();
  });
});
