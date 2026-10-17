/**
 * The rewrite of a query: the SQL with `$n` in place of each slot, and the
 * slot names in position order.
 */
export interface Rewrite {
  readonly text: string;
  readonly slots: readonly string[];
}

/**
 * Whether a character can start an identifier.
 */
const starts = (char: string | undefined): boolean =>
  char !== undefined && /[A-Za-z_]/.test(char);

/**
 * Whether a character can continue an identifier.
 */
const continues = (char: string | undefined): boolean =>
  char !== undefined && /[A-Za-z0-9_]/.test(char);

/**
 * The index after the end of a quoted span that starts at `start`. The
 * quote doubled is a literal quote. A string after `E` escapes with a
 * backslash. Throws when the span does not close.
 */
const quoted = (sql: string, start: number, escapes: boolean): number => {
  const quote = sql[start];
  let index = start + 1;
  while (index < sql.length) {
    const char = sql[index];
    if (escapes && char === "\\") {
      index += 2;
      continue;
    }
    if (char === quote) {
      if (sql[index + 1] === quote) {
        index += 2;
        continue;
      }
      return index + 1;
    }
    index++;
  }
  throw new SyntaxError(`has a quote that does not close`);
};

/**
 * The index after the end of a dollar-quoted string that starts at `start`,
 * or `undefined` when the text at `start` does not open one.
 */
const dollar = (sql: string, start: number): number | undefined => {
  const tag = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(start));
  if (!tag) {
    return undefined;
  }
  const close = sql.indexOf(tag[0], start + tag[0].length);
  if (close === -1) {
    throw new SyntaxError(`has a dollar quote that does not close`);
  }
  return close + tag[0].length;
};

/**
 * The index after the end of a block comment that starts at `start`. Block
 * comments nest.
 */
const block = (sql: string, start: number): number => {
  let depth = 0;
  let index = start;
  while (index < sql.length) {
    if (sql.startsWith("/*", index)) {
      depth++;
      index += 2;
    } else if (sql.startsWith("*/", index)) {
      depth--;
      index += 2;
      if (depth === 0) {
        return index;
      }
    } else {
      index++;
    }
  }
  throw new SyntaxError(`has a comment that does not close`);
};

/**
 * Rewrites the slots of a query to positions. A slot is `:name` outside a
 * string, a quoted identifier, a dollar quote, and a comment, and not part
 * of a `::` cast. A name used twice binds one position. A `$n` parameter in
 * the source is an error: a query names its slots.
 *
 * @param sql - The SQL of a query, as written.
 * @throws SyntaxError when a quote or a comment does not close, or the SQL
 *   holds a `$n` parameter.
 */
export const rewrite = (sql: string): Rewrite => {
  const slots: string[] = [];
  let text = "";
  let index = 0;

  const copy = (end: number) => {
    text += sql.slice(index, end);
    index = end;
  };

  while (index < sql.length) {
    const char = sql[index];
    if (char === "'") {
      const before = sql[index - 1];
      const escapes =
        (before === "E" || before === "e") && !continues(sql[index - 2]);
      copy(quoted(sql, index, escapes));
    } else if (char === '"') {
      copy(quoted(sql, index, false));
    } else if (char === "$") {
      const end = dollar(sql, index);
      if (end !== undefined) {
        copy(end);
      } else if (/[0-9]/.test(sql[index + 1] ?? "")) {
        throw new SyntaxError(`uses a $n parameter; name the slot instead`);
      } else {
        copy(index + 1);
      }
    } else if (sql.startsWith("--", index)) {
      const end = sql.indexOf("\n", index);
      copy(end === -1 ? sql.length : end);
    } else if (sql.startsWith("/*", index)) {
      copy(block(sql, index));
    } else if (sql.startsWith("::", index)) {
      copy(index + 2);
    } else if (char === ":" && starts(sql[index + 1])) {
      let end = index + 1;
      while (continues(sql[end])) {
        end++;
      }
      const name = sql.slice(index + 1, end);
      if (!slots.includes(name)) {
        slots.push(name);
      }
      text += `$${slots.indexOf(name) + 1}`;
      index = end;
    } else {
      copy(index + 1);
    }
  }

  return { text, slots };
};
