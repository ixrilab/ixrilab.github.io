import assert from "node:assert/strict";
import { runRefresh } from "../data-tools/run-refresh.mjs";
import { refreshTracker } from "../data-tools/refresh-tracker.mjs";

const now = new Date("2026-11-04T01:00:00Z");
const refresh = async () => ({ jobs: { verified: 2, unverified: 0 }, funding: { kept: 3, verified: 3, unverified: 0 } });
const audit = async () => ({ source: { status: "Verified" }, summary: { fullPortalScan: 2, failedAdapters: 0 } });
const discover = async () => ({ sourcesChecked: [{ status: "Verified", institution: "Example" }] });

const partial = await runRefresh({ now, write: false, discover: async () => { throw new Error("source unavailable"); }, refresh, audit });
assert.equal(partial.status, "partial");
assert.equal(partial.stages.discovery.status, "failed");
assert.equal(partial.stages.faculty.status, "ok", "discovery failure must not stop faculty refresh");
assert.equal(partial.stages.funding.status, "ok", "discovery failure must not stop funding refresh");
assert.equal(partial.stages.coverage.status, "ok");

const mixed = await runRefresh({ now, write: false, discover, refresh: async () => ({ jobs: { error: "faculty failed" }, funding: { verified: 2, unverified: 0 } }), audit });
assert.equal(mixed.stages.faculty.status, "failed");
assert.equal(mixed.stages.funding.status, "ok");

const registryFailed = await runRefresh({ now, write: false, discover, refresh, audit: async () => { throw new Error("registry unavailable"); } });
assert.equal(registryFailed.stages.faculty.status, "ok");
assert.equal(registryFailed.stages.funding.status, "ok");
assert.equal(registryFailed.stages.coverage.status, "failed");

const healthy = await runRefresh({ now, write: false, discover, refresh, audit });
assert.equal(healthy.status, "ok");

// Exercise the real dataset coordinator: a faculty exception must not prevent
// funding records from being processed, even before orchestration handles it.
const independent = await refreshTracker({
  now, write: false,
  load: async (url) => url.pathname.endsWith("/jobs.json")
    ? { jobs: [{ id: "faculty", status: "Open", university: "Example", officialUrl: "https://example.edu/faculty" }] }
    : { opportunities: [{ id: "grant", status: "Rolling", url: "https://example.edu/grant" }] },
  inspect: async (url) => {
    if (url.endsWith("/faculty")) throw new Error("faculty adapter failure");
    return { state: "active", detail: "HTTP 200" };
  },
});
assert.equal(independent.jobs.error, "faculty adapter failure");
assert.ok(independent.funding.verified > 0);
assert.equal(independent.wroteFiles, false);

console.log(JSON.stringify({ status: "valid", suite: "independent refresh stages" }, null, 2));
