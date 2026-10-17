import { describe, expect, it } from "vitest";

import { SchemaError } from "../src/error";
import type { Issue } from "../src/types";

/** A custom issue with the given message and path. */
const issue = (over: { message?: string; path?: PropertyKey[] }): Issue => ({
  code: "custom",
  message: over.message ?? "must be a string.",
  path: over.path ?? [],
  input: undefined,
});

describe("SchemaError", () => {
  it("is an Error named SchemaError", () => {
    const error = new SchemaError([issue({})]);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("SchemaError");
  });

  it("carries the issues it was constructed with", () => {
    const issues = [issue({ message: "one" }), issue({ message: "two" })];
    const error = new SchemaError(issues);
    expect(error.issues).toBe(issues);
  });

  it("summarizes issues into a multi-line message", () => {
    const error = new SchemaError([
      issue({ message: "one" }),
      issue({ message: "two" }),
    ]);
    expect(error.message).toBe("one\ntwo");
  });

  it("prefixes a message with its dotted path when present", () => {
    const error = new SchemaError([
      issue({ message: "bad", path: ["queries", "events.list", 0, "mode"] }),
    ]);
    expect(error.message).toBe("queries.events.list.0.mode: bad");
  });

  it("omits the prefix when the path is empty", () => {
    const error = new SchemaError([issue({ message: "no-path" })]);
    expect(error.message).toBe("no-path");
  });
});
