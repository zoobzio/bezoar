import type { ParserOptions } from "@electric-sql/pglite";

import { quote } from "@bezoar/core";
import { types } from "@electric-sql/pglite";

/**
 * The parsers that make a row match the type table of `@bezoar/schema`.
 * PGlite parses `date` and `timestamp` to a `Date`. The table declares them
 * as strings in the form Postgres writes, so these parsers keep the text.
 * Every other type parses as PGlite parses it.
 */
export const PARSERS: ParserOptions = {
  [types.DATE]: (text: string) => text,
  [types.TIMESTAMP]: (text: string) => text,
};

/**
 * The prefix of the savepoint a transaction inside a transaction opens. The
 * depth of the transaction follows it.
 */
export const SAVEPOINT = "bezoar_";

/**
 * Takes a role for the rest of the transaction. The client has one session,
 * so a scoped executor takes the role inside each transaction it opens
 * rather than on the session, and an executor without a role over the same
 * client is untouched.
 */
export const ROLE = (role: string): string => `SET LOCAL ROLE ${quote(role)}`;
