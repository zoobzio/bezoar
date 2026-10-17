import { describe, expect, it } from "vitest";

import * as bezoar from "../src/index";

describe("bezoar", () => {
  it("re-exports the runtime service", () => {
    expect(typeof bezoar.makeBezoar).toBe("function");
    expect(typeof bezoar.QueryError).toBe("function");
  });

  it("re-exports the schema", () => {
    expect(typeof bezoar.defineSchema).toBe("function");
    expect(bezoar.SCALARS).toContain("int4");
  });
});
