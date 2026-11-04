import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { discoverFacultyJobs } from "./discover-faculty-jobs.mjs";
import { refreshTracker } from "./refresh-tracker.mjs";
import { auditR1Portals } from "./audit-r1-portals.mjs";

const STATUS_URL = new URL("../data/refresh-status.json", import.meta.url);
const failure = (reason) => ({ status: "failed", detail: String(reason?.message || reason) });

function verificationStatus(summary) {
  if (summary.error) return failure(summary.error);
  const { warnings, removals, statusChanges, ...counts } = summary;
  return { status: summary.unverified ? "partial" : "ok", ...counts };
}

async function runRefresh({
  now = new Date(), write = true,
  discover = discoverFacultyJobs, refresh = refreshTracker, audit = auditR1Portals,
} = {}) {
  const stages = {};
  // Discovery must never prevent existing faculty and funding from refreshing.
  const [discovery, updates] = await Promise.allSettled([
    Promise.resolve().then(() => discover({ now, write })),
    Promise.resolve().then(() => refresh({ now, write })),
  ]);
  if (discovery.status === "fulfilled") {
    const sources = discovery.value.sourcesChecked;
    const failed = sources.filter((source) => source.status === "Failed");
    const verified = sources.filter((source) => source.status === "Verified").length;
    stages.discovery = {
      status: failed.length ? (verified ? "partial" : "failed") : verified ? "ok" : "failed",
      verified, total: sources.length,
      failedSources: failed.map(({ institution, detail }) => ({ institution, detail })),
    };
  } else stages.discovery = failure(discovery.reason);

  if (updates.status === "fulfilled") {
    stages.faculty = verificationStatus(updates.value.jobs);
    stages.funding = verificationStatus(updates.value.funding);
  } else {
    stages.faculty = failure(updates.reason);
    stages.funding = failure(updates.reason);
  }

  // Build coverage after discovery and record refreshes so it reflects this run.
  try {
    const coverage = await audit({ now, write });
    stages.coverage = {
      status: coverage.source.status === "Verified" && !coverage.summary.failedAdapters ? "ok" : "partial",
      fullPortalScans: coverage.summary.fullPortalScan,
      failedAdapters: coverage.summary.failedAdapters,
      registryStatus: coverage.source.status,
    };
  } catch (error) { stages.coverage = failure(error); }

  const states = Object.values(stages).map(({ status }) => status);
  const output = {
    generatedAt: now.toISOString(), timezone: "Australia/Sydney",
    status: states.every((status) => status === "ok") ? "ok"
      : states.every((status) => status === "failed") ? "failed" : "partial",
    stages,
  };
  if (write) await writeFile(STATUS_URL, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const output = await runRefresh({ write: !process.argv.includes("--dry-run") });
  console.log(JSON.stringify(output, null, 2));
  // A blocked individual link is a warning. A failed stage still fails CI,
  // after the workflow saves any other valid updates and the status report.
  if (Object.values(output.stages).some((stage) => stage.status === "failed")) process.exitCode = 1;
  else if (output.status === "partial") console.warn("::warning::Refresh completed with source verification warnings; see data/refresh-status.json.");
}

export { runRefresh, verificationStatus };
