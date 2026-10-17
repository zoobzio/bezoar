import type { OutputFile } from "./types";

import { record } from "objectively";

import { BANNER } from "./constant";

/**
 * Pretty JSON. The text is also a JavaScript expression, so it is the
 * literal an emitted module exports.
 */
export const json = (value: unknown): string => JSON.stringify(value, null, 2);

/**
 * The type of a value as a readonly literal: each string, number, and
 * boolean as itself, each array as a tuple, each record as an object type.
 * The declaration of an emitted constant, so its literal types reach the
 * consumer.
 *
 * @param value - Plain data.
 * @param depth - The nesting, for the indent.
 */
export const literal = (value: unknown, depth = 0): string => {
  const pad = "  ".repeat(depth);
  const inner = "  ".repeat(depth + 1);
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "readonly []";
    }
    const items = value.map((item) => `${inner}${literal(item, depth + 1)},`);
    return `readonly [\n${items.join("\n")}\n${pad}]`;
  }
  if (record(value)) {
    const members = Object.entries(value).map(
      ([key, member]) =>
        `${inner}readonly ${JSON.stringify(key)}: ${literal(member, depth + 1)};`,
    );
    return `{\n${members.join("\n")}\n${pad}}`;
  }
  return JSON.stringify(value);
};

/**
 * A module and its declaration, side by side. A `.d.mts` is what TypeScript
 * pairs with an `.mjs`.
 *
 * @param name - The name of the module, without an extension.
 * @param module - The lines of the module.
 * @param declaration - The lines of the declaration.
 */
export const pair = (
  name: string,
  module: string[],
  declaration: string[],
): OutputFile[] => [
  { path: `${name}.mjs`, contents: `${[BANNER, ...module].join("\n")}\n` },
  {
    path: `${name}.d.mts`,
    contents: `${[BANNER, ...declaration].join("\n")}\n`,
  },
];
