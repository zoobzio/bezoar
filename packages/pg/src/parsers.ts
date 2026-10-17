import type { CustomTypesConfig } from "pg";

import type { Parser, Session } from "./types";

import driver from "pg";
import { parse as parseArray } from "postgres-array";

import {
  DATE,
  DATE_ARRAY,
  INT8,
  INT8_ARRAY,
  TIMESTAMP,
  TIMESTAMP_ARRAY,
} from "./constant";

/**
 * The text as it is.
 */
const same: Parser = (text) => text;

/**
 * An `int8` as a number in the safe range, and as a bigint outside it.
 */
const int8: Parser = (text) => {
  const number = Number(text);
  return Number.isSafeInteger(number) ? number : BigInt(text);
};

/**
 * An array of a type, parsed element by element.
 */
export const arrayOf =
  (element: Parser): Parser =>
  (text) =>
    parseArray(text, element);

/**
 * The parsers that make a row match the type table of `@bezoar/schema`.
 * node-postgres parses `int8` to a string and `date` and `timestamp` to a
 * `Date`. The table declares `int8` as a number, and the two temporal types
 * as strings in the form Postgres writes. Every other type parses as
 * node-postgres parses it.
 */
export const PARSERS: ReadonlyMap<number, Parser> = new Map([
  [INT8, int8],
  [DATE, same],
  [TIMESTAMP, same],
  [INT8_ARRAY, arrayOf(int8)],
  [DATE_ARRAY, arrayOf(same)],
  [TIMESTAMP_ARRAY, arrayOf(same)],
]);

/**
 * The type config of a query: the parsers of the executor first, then the
 * arrays of enums the session read, then node-postgres.
 *
 * @param session - The session whose enum arrays apply.
 */
export const typesOf = (session: Session): CustomTypesConfig => ({
  getTypeParser: (oid, format) =>
    PARSERS.get(oid) ??
    session.arrays.get(oid) ??
    driver.types.getTypeParser(oid, format),
});
