import { describe, expect, it } from "vitest";

import { rewrite } from "../src/slots";

describe("rewrite", () => {
  it("rewrites each slot to its position", () => {
    expect(rewrite("SELECT * FROM t WHERE a = :a AND b = :b")).toEqual({
      text: "SELECT * FROM t WHERE a = $1 AND b = $2",
      slots: ["a", "b"],
    });
  });

  it("binds a name used twice to one position", () => {
    expect(rewrite("WHERE :x IS NULL OR c = :x")).toEqual({
      text: "WHERE $1 IS NULL OR c = $1",
      slots: ["x"],
    });
  });

  it("leaves a :: cast alone", () => {
    expect(rewrite("SELECT :n::int, a::text FROM t")).toEqual({
      text: "SELECT $1::int, a::text FROM t",
      slots: ["n"],
    });
  });

  it("leaves a colon inside a string literal alone", () => {
    expect(rewrite("SELECT 'a:b', 'it''s :c', :d")).toEqual({
      text: "SELECT 'a:b', 'it''s :c', $1",
      slots: ["d"],
    });
  });

  it("leaves a colon inside an escape string alone", () => {
    expect(rewrite("SELECT E'\\':x', :y")).toEqual({
      text: "SELECT E'\\':x', $1",
      slots: ["y"],
    });
  });

  it("leaves a colon inside a quoted identifier alone", () => {
    expect(rewrite('SELECT "a:b", :c FROM t')).toEqual({
      text: 'SELECT "a:b", $1 FROM t',
      slots: ["c"],
    });
  });

  it("leaves a colon inside a dollar quote alone", () => {
    expect(rewrite("SELECT $$:a$$, $tag$ :b $tag$, :c")).toEqual({
      text: "SELECT $$:a$$, $tag$ :b $tag$, $1",
      slots: ["c"],
    });
  });

  it("leaves a colon inside a comment alone", () => {
    expect(
      rewrite("SELECT :a -- not :b\n, /* nor :c /* nested */ */ :d"),
    ).toEqual({
      text: "SELECT $1 -- not :b\n, /* nor :c /* nested */ */ $2",
      slots: ["a", "d"],
    });
  });

  it("leaves a colon before a digit alone", () => {
    expect(rewrite("SELECT arr[1:3], '10:30'::time, :x")).toEqual({
      text: "SELECT arr[1:3], '10:30'::time, $1",
      slots: ["x"],
    });
  });

  it("rejects a $n parameter", () => {
    expect(() => rewrite("SELECT $1")).toThrow(/\$n parameter/);
  });

  it("rejects a quote or a comment that does not close", () => {
    expect(() => rewrite("SELECT 'open")).toThrow(/quote/);
    expect(() => rewrite("SELECT $$open")).toThrow(/dollar quote/);
    expect(() => rewrite("SELECT /* open")).toThrow(/comment/);
  });
});
