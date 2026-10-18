import type {
  Arguments,
  Database,
  Returns,
  Row,
  RowQuery,
} from "@bezoar/schema";
import type { Generated } from "kysely";

import type { Contract } from "../.dist/index.mjs";

/**
 * The types a consumer derives from the build. `pnpm typecheck` proves each
 * one against the declaration `bezoar build` wrote.
 */
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Assert<T extends true> = T;

type Status = "scheduled" | "boarding" | "departed" | "cancelled";

export type Checks = [
  Assert<Equal<Arguments<Contract, "departures.upcoming">, { after: Date }>>,
  Assert<
    Equal<
      Arguments<Contract, "bookings.create">,
      { departure: number; passenger: string; email: string; seats: number }
    >
  >,
  Assert<Equal<Arguments<Contract, "stations.list">, Record<never, never>>>,
  Assert<
    Equal<
      Row<Contract, "departures.upcoming">,
      {
        id: number;
        route: string;
        origin: string;
        destination: string;
        departs_at: Date;
        status: Status;
        seats: number;
        seats_left: number;
      }
    >
  >,
  Assert<Equal<Row<Contract, "departures.byId">["note"], string | null>>,
  Assert<
    Equal<
      Returns<Contract, "bookings.create">,
      { id: number; booked_at: Date }[]
    >
  >,
  Assert<Equal<Returns<Contract, "bookings.cancel">, number>>,
  Assert<
    Equal<
      RowQuery<Contract>,
      | "bookings.create"
      | "bookings.forDeparture"
      | "departures.byId"
      | "departures.upcoming"
      | "routes.list"
      | "stations.list"
    >
  >,
  Assert<Equal<Returns<Contract, "routes.list">[number]["nights"], number>>,
  Assert<
    Equal<
      keyof Database<Contract>,
      "bookings" | "departures" | "routes" | "stations"
    >
  >,
  Assert<
    Equal<
      Database<Contract>["departures"],
      {
        id: Generated<number>;
        route_id: number;
        departs_at: Date;
        seats: number;
        status: Generated<Status>;
        note: string | null;
      }
    >
  >,
];

// @ts-expect-error A booking needs its passenger.
export const incomplete: Arguments<Contract, "bookings.create"> = {
  departure: 1,
  email: "ada@example.com",
  seats: 1,
};
