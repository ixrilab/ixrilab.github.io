import assert from "node:assert/strict";
import { daysUntil, isDefinitelyClosed, refreshCollection, todayInTimezone } from "../data-tools/refresh-tracker.mjs";

assert.equal(todayInTimezone(new Date("2026-09-20T23:30:00Z")), "2026-09-21");
assert.equal(daysUntil("2026-09-30", "2026-09-21"), 9);
assert.equal(daysUntil("Check original posting", "2026-09-21"), null);
assert.equal(isDefinitelyClosed("This job is no longer available."), true);
assert.equal(isDefinitelyClosed("Applications are open until 30 September."), false);

const items = [
  { id: "expired", deadline: "2026-09-20", daysLeft: 1, checkedAt: "2026-09-01", url: "https://example.com/expired" },
  { id: "active", deadline: "2026-09-30", daysLeft: 99, checkedAt: "2026-09-01", url: "https://example.com/active" },
  { id: "closed", deadline: "Check original posting", daysLeft: null, checkedAt: "2026-09-01", url: "https://example.com/closed" },
  { id: "blocked", deadline: "Check original posting", daysLeft: null, checkedAt: "2026-09-01", url: "https://example.com/blocked" },
];

const states = new Map([
  ["active", { state: "active", detail: "HTTP 200" }],
  ["closed", { state: "closed", detail: "HTTP 410" }],
  ["blocked", { state: "unverified", detail: "HTTP 403" }],
]);

const { items: refreshed, summary } = await refreshCollection(items, {
  today: "2026-09-21",
  kind: "job",
  inspect: async (url) => states.get(url.split("/").at(-1)),
});

assert.deepEqual(refreshed.map((item) => item.id), ["active", "blocked"]);
assert.equal(refreshed[0].checkedAt, "2026-09-21");
assert.equal(refreshed[0].daysLeft, 9);
assert.equal(refreshed[1].checkedAt, "2026-09-01", "a blocked source must not be reported as verified");
assert.deepEqual({ ...summary, removals: undefined, warnings: undefined }, {
  kept: 2,
  verified: 1,
  expired: 1,
  closed: 1,
  unverified: 1,
  removals: undefined,
  warnings: undefined,
});
assert.deepEqual(summary.removals, [
  { id: "expired", reason: "deadline 2026-09-20" },
  { id: "closed", reason: "HTTP 410" },
]);
assert.equal(summary.warnings.length, 1);

console.log(JSON.stringify({ status: "valid", tests: 12 }, null, 2));
