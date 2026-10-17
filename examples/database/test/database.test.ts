import { makeTestBezoar } from "@bezoar/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { contract } from "../.dist/index.mjs";
import { migrations } from "../.dist/migrations.mjs";
import { queries } from "../.dist/queries.mjs";
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
