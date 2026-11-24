// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { dueLabel, nextDue } from "./dates.ts";

test("nextDue steps past today", () => {
  assert.equal(nextDue("2026-11-20", "daily", "2026-11-23"), "2026-11-24");
  assert.equal(nextDue("2026-11-20", "weekly", "2026-11-23"), "2026-11-27");
  assert.equal(nextDue("2026-11-27", "weekly", "2026-11-23"), "2026-12-04");
});

test("nextDue clamps month ends without drifting", () => {
  assert.equal(nextDue("2026-01-31", "monthly", "2026-01-31"), "2026-02-28");
  assert.equal(nextDue("2026-01-31", "monthly", "2026-02-28"), "2026-03-31");
  assert.equal(nextDue("2028-02-29", "yearly", "2028-02-29"), "2029-02-28");
});

test("dueLabel", () => {
  assert.deepEqual(dueLabel(null, "2026-11-23"), { label: "No date", tone: "none" });
  assert.equal(dueLabel("2026-11-23", "2026-11-23").label, "Today");
  assert.equal(dueLabel("2026-11-24", "2026-11-23").label, "Tomorrow");
  assert.equal(dueLabel("2026-11-22", "2026-11-23").label, "Yesterday");
  assert.equal(dueLabel("2026-11-20", "2026-11-23").tone, "overdue");
  assert.equal(dueLabel("2026-11-27", "2026-11-23").label, "Fri");
  assert.equal(dueLabel("2027-01-05", "2026-11-23").label, "5 Jan 2027");
});
