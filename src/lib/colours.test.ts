import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_COLOURS, coloursSchema, parseColours, tints } from "./colours.ts";

test("depth 0 keeps the original tints, and the ends stay in range", () => {
  assert.deepEqual(tints(0), { bg: 10, chip: 27 });
  assert.deepEqual(tints(-5), { bg: 5, chip: 22 });
  assert.deepEqual(tints(5), { bg: 25, chip: 42 });
});

test("parseColours falls back to the defaults on anything invalid", () => {
  const saved = { ...DEFAULT_COLOURS, q1: "#123abc", depth: 3 };
  assert.deepEqual(parseColours(JSON.stringify(saved)), saved);
  assert.deepEqual(parseColours(null), DEFAULT_COLOURS);
  assert.deepEqual(parseColours("not json"), DEFAULT_COLOURS);
  assert.deepEqual(parseColours(JSON.stringify({ ...saved, depth: 9 })), DEFAULT_COLOURS);
});

test("only plain hex colours get through, so nothing can break out of the style attribute", () => {
  for (const bad of ["red", "#fff", "#000000;color:red", "url(x)", ""]) {
    assert.equal(coloursSchema.safeParse({ ...DEFAULT_COLOURS, q2: bad }).success, false, bad);
  }
  assert.equal(coloursSchema.safeParse({ ...DEFAULT_COLOURS, extra: 1 }).success, false);
});
