import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const JOBS_PATH = new URL("../data/jobs.json", import.meta.url);

function eventFor(existing, incoming) {
  if (!existing) return { type: "Newly Posted", detail: "Added after official-source verification." };
  if (existing.status !== incoming.status) {
    const type = incoming.status === "Closed" ? "Closed" : "Status Changed";
    return { type, detail: `Status changed from ${existing.status} to ${incoming.status}.` };
  }
  if (existing.priorityDate !== incoming.priorityDate || existing.finalDeadline !== incoming.finalDeadline) {
    return {
      type: "Deadline/Review Date Changed",
      detail: `Review date ${existing.priorityDate || "not stated"} → ${incoming.priorityDate || "not stated"}; final deadline ${existing.finalDeadline || "not stated"} → ${incoming.finalDeadline || "not stated"}.`,
    };
  }
  return null;
}

function mergeFacultyJobs(existingJobs, incomingJobs, today) {
  const existingById = new Map(existingJobs.map((job) => [job.id, job]));
  const incomingIds = new Set();
  const officialUrls = new Set();

  const merged = incomingJobs.map((incoming) => {
    if (incomingIds.has(incoming.id)) throw new Error(`Duplicate incoming id: ${incoming.id}`);
    if (officialUrls.has(incoming.officialUrl)) throw new Error(`Duplicate incoming official URL: ${incoming.officialUrl}`);
    incomingIds.add(incoming.id);
    officialUrls.add(incoming.officialUrl);

    const existing = existingById.get(incoming.id);
    const event = eventFor(existing, incoming);
    return {
      ...existing,
      ...incoming,
      firstSeen: existing?.firstSeen || today,
      lastVerified: incoming.lastVerified || today,
      changeType: event?.type || "Unchanged",
      changeLog: event
        ? [...(existing?.changeLog || []), { date: today, ...event }]
        : [...(existing?.changeLog || [])],
    };
  });

  for (const existing of existingJobs) {
    if (!incomingIds.has(existing.id)) merged.push(existing);
  }
  return merged;
}

async function main() {
  const incomingFlag = process.argv.indexOf("--incoming");
  if (incomingFlag === -1 || !process.argv[incomingFlag + 1]) {
    throw new Error("Usage: node data-tools/merge-faculty-jobs.mjs --incoming <reviewed-json> [--write]");
  }
  const incomingPath = resolve(process.argv[incomingFlag + 1]);
  const [currentPayload, incomingPayload] = await Promise.all([
    readFile(JOBS_PATH, "utf8").then(JSON.parse),
    readFile(incomingPath, "utf8").then(JSON.parse),
  ]);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: currentPayload.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  currentPayload.generatedAt = new Date().toISOString();
  currentPayload.jobs = mergeFacultyJobs(currentPayload.jobs, incomingPayload.jobs, today);
  if (process.argv.includes("--write")) {
    await writeFile(JOBS_PATH, `${JSON.stringify(currentPayload, null, 2)}\n`, "utf8");
  }
  console.log(JSON.stringify({ jobs: currentPayload.jobs.length, wroteFiles: process.argv.includes("--write") }, null, 2));
}

const isEntryPoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) await main();

export { eventFor, mergeFacultyJobs };
