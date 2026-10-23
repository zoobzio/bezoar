import { makeTestBezoar } from "@bezoar/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { contract } from "../.dist/index.mjs";
import { migrations } from "../.dist/migrations.mjs";
import { queries } from "../.dist/queries.mjs";
import { roles } from "../.dist/roles.mjs";
import { seeds } from "../.dist/seeds.mjs";

let db: Awaited<ReturnType<typeof makeTestBezoar<typeof contract>>>;

beforeAll(async () => {
  db = await makeTestBezoar(contract, { queries, migrations, seeds });
});

afterAll(() => db.close());

describe("the Solstice Rail database", () => {
  it("lists the stations by name", async () => {
    const stations = await db.stations.list();
    expect(stations.map((station) => station.code)).toEqual([
      "BER",
      "PAR",
      "STO",
      "VIE",
    ]);
  });

  it("lists the routes with the names of their stations", async () => {
    const routes = await db.routes.list();
    expect(routes[0]).toMatchObject({
      slug: "berlin-stockholm",
      origin: "Berlin Hauptbahnhof",
      destination: "Stockholm Central",
      nights: 1,
    });
  });

  it("lists the upcoming departures with the seats left", async () => {
    const departures = await db.departures.upcoming({
      after: new Date("2026-11-01T00:00:00Z"),
    });
    expect(departures).toHaveLength(4);
    expect(departures[0]).toMatchObject({
      route: "berlin-stockholm",
      status: "scheduled",
      seats: 120,
      seats_left: 118,
    });
    expect(departures[0]?.departs_at).toBeInstanceOf(Date);
  });

  it("books seats and counts them against the departure", async () => {
    const [first] = await db.departures.upcoming({
      after: new Date("2026-11-01T00:00:00Z"),
    });
    const booking = await db.bookings.create.first({
      departure: first!.id,
      passenger: "Grace Hopper",
      email: "grace@example.com",
      seats: 3,
    });
    expect(booking?.booked_at).toBeInstanceOf(Date);

    const [after] = await db.departures.upcoming({
      after: new Date("2026-11-01T00:00:00Z"),
    });
    expect(after?.seats_left).toBe(115);

    const bookings = await db.bookings.forDeparture({ departure: first!.id });
    expect(bookings.map((entry) => entry.passenger)).toEqual([
      "Ada Lovelace",
      "Grace Hopper",
    ]);

    expect(await db.bookings.cancel({ id: booking!.id })).toBe(1);
  });

  it("finds a departure by id, or nothing", async () => {
    const [first] = await db.departures.upcoming({
      after: new Date("2026-11-01T00:00:00Z"),
    });
    expect(await db.departures.byId.first({ id: first!.id })).toMatchObject({
      route: "berlin-stockholm",
      note: null,
    });
    expect(await db.departures.byId.first({ id: 9999 })).toBeNull();
  });
});

describe("the query builder over the database", () => {
  it("builds a query over the tables of the contract", async () => {
    const stations = await db.build
      .selectFrom("stations")
      .select(["code", "name"])
      .where("country", "=", "SE")
      .orderBy("code")
      .execute();
    expect(stations).toEqual([{ code: "STO", name: "Stockholm Central" }]);
  });

  it("joins and aggregates with the helpers of the builder", async () => {
    const seats = await db.execute(
      db.build
        .selectFrom("departures")
        .innerJoin("routes", "routes.id", "departures.route_id")
        .select((eb) => [
          "routes.slug",
          eb.fn.sum<number>("departures.seats").as("seats"),
        ])
        .groupBy("routes.slug")
        .orderBy("routes.slug"),
      z.object({ slug: z.string(), seats: z.coerce.number() }),
    );
    expect(seats[0]).toMatchObject({ slug: "berlin-stockholm" });
    expect(seats.every((row) => row.seats > 0)).toBe(true);
  });

  it("writes inside a transaction of the service and rolls back with it", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.build
          .insertInto("stations")
          .values({
            code: "OSL",
            name: "Oslo S",
            country: "Norway",
            timezone: "Europe/Oslo",
          })
          .execute();
        const count = await tx.execute.first(
          tx.build
            .selectFrom("stations")
            .select((eb) => eb.fn.countAll().as("total")),
          z.object({ total: z.coerce.number() }),
        );
        expect(count).toEqual({ total: 5 });
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");
    expect(await db.stations.list()).toHaveLength(4);
  });
});

describe("the roles of the database", () => {
  it("carries what each role may run", () => {
    expect(contract.roles.desk).toEqual(Object.keys(contract.queries).sort());
    expect(contract.roles.board).toEqual([
      "departures.byId",
      "departures.upcoming",
      "routes.list",
      "stations.list",
    ]);
  });

  it("scopes a service to the board, which reads the timetable and books nothing", async () => {
    await using board = await makeTestBezoar(contract, {
      queries,
      migrations,
      seeds,
      roles,
      role: "board",
    });
    const departures = await board.departures.upcoming({
      after: new Date("2026-11-01T00:00:00Z"),
    });
    expect(departures[0]).toMatchObject({ seats_left: 118 });
    expect("bookings" in board).toBe(false);
    const refused = await board
      .execute(board.build.selectFrom("bookings").select("passenger"))
      .catch((error: unknown) => error);
    expect(refused).toMatchObject({ name: "QueryError", query: "build" });
    expect(String((refused as Error).cause)).toContain("permission denied");
  });
});
