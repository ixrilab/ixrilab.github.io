import assert from "node:assert/strict";
import {
  daysUntil,
  isDefinitelyClosed,
  postingAgeStatus,
  priorityScore,
  refreshJobs,
  todayInTimezone,
} from "../data-tools/refresh-tracker.mjs";
import { mergeFacultyJobs } from "../data-tools/merge-faculty-jobs.mjs";

assert.equal(todayInTimezone(new Date("2026-09-20T23:30:00Z")), "2026-09-21");
assert.equal(daysUntil("2026-09-30", "2026-09-21"), 9);
assert.equal(daysUntil(null, "2026-09-21"), null);
assert.equal(postingAgeStatus("2026-03-21", "2026-09-21"), "Older than 6 months — reconfirm");
assert.equal(postingAgeStatus("2026-03-22", "2026-09-21"), "Under 6 months");
assert.equal(postingAgeStatus(null, "2026-09-21"), "Date unavailable");
assert.equal(isDefinitelyClosed("This job is no longer available."), true);
assert.equal(isDefinitelyClosed("Applications are open until 30 September."), false);

const base = {
  country: "United States",
  university: "Example University",
  department: "Computer Science",
  title: "Assistant Professor in HCI",
  rankTrack: "Assistant Professor",
  researchArea: "HCI",
  priorityDate: null,
  finalDeadline: null,
  postedDate: null,
  status: "Open",
  officialUrl: "https://example.com/job",
  fitLevel: "Direct",
  fitNote: "Direct HCI fit.",
  institutionStrength: "Very Strong",
  institutionScore: 5,
  collaborationEvidenceScore: 100,
  firstSeen: "2026-09-01",
  lastVerified: "2026-09-01",
  changeType: "Unchanged",
  changeLog: [],
};

assert.equal(priorityScore(base, "2026-09-21"), 82);
assert.equal(priorityScore({ ...base, postedDate: "2026-03-21" }, "2026-09-21"), 66);
assert.equal(priorityScore({ ...base, postedDate: "2026-03-22" }, "2026-09-21"), 88);
assert.ok(
  priorityScore({
    ...base,
    fitLevel: "Direct",
    institutionStrength: "Strong",
    rankTrack: "Open Rank (Assistant accepted)",
    collaborationEvidenceScore: 0,
  }, "2026-09-21")
    > priorityScore({
      ...base,
      fitLevel: "Strong",
      institutionStrength: "Exceptional",
      collaborationEvidenceScore: 180,
      postedDate: "2026-09-01",
      priorityDate: "2026-10-01",
      finalDeadline: "2026-10-01",
    }, "2026-09-21"),
  "a weaker fit tier must never outrank a stronger fit tier",
);
assert.equal(priorityScore({
  ...base,
  fitLevel: "Direct",
  institutionStrength: "Exceptional",
  collaborationEvidenceScore: 180,
  postedDate: "2026-09-01",
  priorityDate: "2026-10-01",
  finalDeadline: "2026-10-01",
}, "2026-09-21"), 100);

const items = [
  { ...base, id: "expired", finalDeadline: "2026-09-20", officialUrl: "https://example.com/expired" },
  { ...base, id: "active", finalDeadline: "2026-09-30", officialUrl: "https://example.com/active" },
  { ...base, id: "closed", officialUrl: "https://example.com/closed" },
  { ...base, id: "blocked", officialUrl: "https://example.com/blocked" },
];

const states = new Map([
  ["active", { state: "active", detail: "HTTP 200" }],
  ["closed", { state: "closed", detail: "HTTP 410" }],
  ["blocked", { state: "unverified", detail: "HTTP 403" }],
]);

const { items: refreshed, summary } = await refreshJobs(items, {
  today: "2026-09-21",
  inspect: async (url) => states.get(url.split("/").at(-1)),
});

assert.equal(refreshed.length, 4, "closed jobs must remain in history");
assert.equal(refreshed.find((job) => job.id === "expired").status, "Closed");
assert.equal(refreshed.find((job) => job.id === "closed").status, "Closed");
assert.equal(refreshed.find((job) => job.id === "active").lastVerified, "2026-09-21");
assert.equal(refreshed.find((job) => job.id === "blocked").lastVerified, "2026-09-01", "a blocked source must not be reported as verified");
assert.equal(summary.retained, 4);
assert.equal(summary.expired, 1);
assert.equal(summary.closed, 2);
assert.equal(summary.active, 2);
assert.equal(summary.closedTotal, 2);
assert.equal(summary.unverified, 1);
assert.equal(summary.statusChanges.length, 2);

const existingForMerge = [{
  ...base,
  id: "tracked",
  firstSeen: "2026-08-01",
  changeLog: [{ date: "2026-08-01", type: "Newly Posted", detail: "Added." }],
}];
const deadlineChanged = mergeFacultyJobs(existingForMerge, [{
  ...existingForMerge[0],
  priorityDate: "2026-10-01",
}], "2026-09-21")[0];
assert.equal(deadlineChanged.changeType, "Deadline/Review Date Changed");
assert.equal(deadlineChanged.changeLog.length, 2);
const closedByMerge = mergeFacultyJobs(existingForMerge, [{ ...existingForMerge[0], status: "Closed" }], "2026-09-21")[0];
assert.equal(closedByMerge.changeType, "Closed");
const newByMerge = mergeFacultyJobs([], [{ ...base, id: "new" }], "2026-09-21")[0];
assert.equal(newByMerge.changeType, "Newly Posted");
assert.equal(newByMerge.firstSeen, "2026-09-21");

console.log(JSON.stringify({ status: "valid", tests: 30 }, null, 2));
