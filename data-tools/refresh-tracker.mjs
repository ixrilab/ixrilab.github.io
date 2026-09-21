import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const JOBS_URL = new URL("../data/jobs.json", import.meta.url);
const FUNDING_URL = new URL("../data/funding.json", import.meta.url);
const TIMEZONE = "Australia/Sydney";
const REQUEST_TIMEOUT_MS = 20_000;
const CONCURRENCY = 6;
const MAX_BODY_BYTES = 750_000;

const CLOSED_PATTERNS = [
  /applications? (?:are|is) (?:now )?closed/i,
  /applications? (?:are|is) no longer (?:being )?accepted/i,
  /job (?:is )?no longer available/i,
  /no longer accepting applications/i,
  /position has been filled/i,
  /posting (?:has )?expired/i,
  /vacancy (?:is|has been) closed/i,
  /this opportunity (?:is )?closed/i,
];

const FIT_WEIGHTS = { Direct: 1000, Strong: 600, Broad: 200 };
const RANK_WEIGHTS = {
  "Assistant Professor": 30,
  "Assistant/Associate Professor": 25,
  "Open Rank (Assistant accepted)": 20,
};

function todayInTimezone(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "");
}

function daysUntil(deadline, today) {
  if (!isIsoDate(deadline)) return null;
  return Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

function postingAgeStatus(postedDate, today) {
  if (!isIsoDate(postedDate)) return "Date unavailable";
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 6);
  return Date.parse(`${postedDate}T00:00:00Z`) <= cutoff.valueOf()
    ? "Older than 6 months — reconfirm"
    : "Under 6 months";
}

function priorityScore(job, today) {
  const remaining = daysUntil(job.finalDeadline, today);
  const urgency = remaining !== null && remaining >= 0 && remaining <= 30
    ? Math.min(9, Math.ceil((31 - remaining) / 4))
    : 0;
  return (FIT_WEIGHTS[job.fitLevel] || 0)
    + (job.collaborationScore || 0)
    + (job.institutionScore || 0)
    + (RANK_WEIGHTS[job.rankTrack] || 0)
    + urgency;
}

function isDefinitelyClosed(text) {
  return CLOSED_PATTERNS.some((pattern) => pattern.test(text));
}

async function readBodyPrefix(response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";

  try {
    while (total < MAX_BODY_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  return text;
}

async function inspectUrl(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-AU,en;q=0.8",
        "User-Agent": "IXRILab-Faculty-Tracker/2.0 (+https://ixrilab.com/)",
      },
    });

    if ([404, 410].includes(response.status)) return { state: "closed", detail: `HTTP ${response.status}` };
    if (!response.ok) return { state: "unverified", detail: `HTTP ${response.status}` };
    const contentType = response.headers.get("content-type") || "";
    if (!/html|text|json/i.test(contentType)) return { state: "active", detail: `HTTP ${response.status}` };
    const body = await readBodyPrefix(response);
    return isDefinitelyClosed(body)
      ? { state: "closed", detail: "closure notice found" }
      : { state: "active", detail: `HTTP ${response.status}` };
  } catch (error) {
    const detail = error?.name === "AbortError" ? "timeout" : String(error?.message || error);
    return { state: "unverified", detail };
  } finally {
    clearTimeout(timer);
  }
}

async function mapConcurrent(items, mapper, concurrency = CONCURRENCY) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

function closeJob(job, today, reason) {
  if (job.status === "Closed") return job;
  return {
    ...job,
    status: "Closed",
    closedAt: today,
    lastVerified: today,
    verificationNote: reason,
    changeType: "Closed",
    changeLog: [...(job.changeLog || []), { date: today, type: "Closed", detail: reason }],
  };
}

async function refreshJobs(items, { today, inspect = inspectUrl }) {
  const summary = { retained: items.length, verified: 0, expired: 0, closed: 0, unverified: 0, statusChanges: [], warnings: [] };
  const jobs = await mapConcurrent(items, async (job) => {
    const agedJob = { ...job, postingAgeStatus: postingAgeStatus(job.postedDate, today) };
    if (agedJob.status === "Closed") return { ...agedJob, priorityScore: priorityScore(agedJob, today) };

    if (isIsoDate(agedJob.finalDeadline) && agedJob.finalDeadline < today) {
      summary.expired += 1;
      summary.closed += 1;
      summary.statusChanges.push({ id: agedJob.id, from: agedJob.status, to: "Closed", reason: `final deadline ${agedJob.finalDeadline}` });
      const closed = closeJob(agedJob, today, `Final deadline passed on ${agedJob.finalDeadline}`);
      return { ...closed, priorityScore: priorityScore(closed, today) };
    }

    const result = await inspect(agedJob.officialUrl);
    if (result.state === "closed") {
      summary.closed += 1;
      summary.statusChanges.push({ id: agedJob.id, from: agedJob.status, to: "Closed", reason: result.detail });
      const closed = closeJob(agedJob, today, result.detail);
      return { ...closed, priorityScore: priorityScore(closed, today) };
    }

    if (result.state === "active") {
      summary.verified += 1;
      return {
        ...agedJob,
        lastVerified: today,
        verificationNote: result.detail,
        changeType: agedJob.firstSeen === today ? "Newly Posted" : "Unchanged",
        priorityScore: priorityScore(agedJob, today),
      };
    }

    summary.unverified += 1;
    summary.warnings.push(`job:${job.id}: ${result.detail}`);
    return { ...agedJob, verificationNote: `Not re-verified: ${result.detail}`, priorityScore: priorityScore(agedJob, today) };
  });

  jobs.sort((a, b) => {
    if ((a.status === "Closed") !== (b.status === "Closed")) return a.status === "Closed" ? 1 : -1;
    return b.priorityScore - a.priorityScore || a.university.localeCompare(b.university);
  });
  summary.active = jobs.filter((job) => job.status !== "Closed").length;
  summary.closedTotal = jobs.length - summary.active;
  return { items: jobs, summary };
}

async function refreshFunding(items, { today, inspect = inspectUrl }) {
  const summary = { kept: 0, verified: 0, expired: 0, closed: 0, unverified: 0, removals: [], warnings: [] };
  const results = await mapConcurrent(items, async (item) => {
    if (isIsoDate(item.deadline) && item.deadline < today) {
      summary.expired += 1;
      summary.removals.push({ id: item.id, reason: `deadline ${item.deadline}` });
      return null;
    }
    const result = await inspect(item.url);
    if (result.state === "closed") {
      summary.closed += 1;
      summary.removals.push({ id: item.id, reason: result.detail });
      return null;
    }
    const refreshed = { ...item };
    if (result.state === "active") {
      refreshed.checkedAt = today;
      summary.verified += 1;
    } else {
      summary.unverified += 1;
      summary.warnings.push(`funding:${item.id}: ${result.detail}`);
    }
    summary.kept += 1;
    return refreshed;
  });
  return { items: results.filter(Boolean), summary };
}

async function refreshTracker({ now = new Date(), inspect = inspectUrl, write = true } = {}) {
  const today = todayInTimezone(now);
  const [jobsPayload, fundingPayload] = await Promise.all([
    readFile(JOBS_URL, "utf8").then(JSON.parse),
    readFile(FUNDING_URL, "utf8").then(JSON.parse),
  ]);
  const [jobsResult, fundingResult] = await Promise.all([
    refreshJobs(jobsPayload.jobs, { today, inspect }),
    refreshFunding(fundingPayload.opportunities, { today, inspect }),
  ]);
  jobsPayload.generatedAt = now.toISOString();
  jobsPayload.jobs = jobsResult.items;
  fundingPayload.generatedAt = now.toISOString();
  fundingPayload.opportunities = fundingResult.items.sort((a, b) => b.score - a.score);
  if (write) {
    await Promise.all([
      writeFile(JOBS_URL, `${JSON.stringify(jobsPayload, null, 2)}\n`, "utf8"),
      writeFile(FUNDING_URL, `${JSON.stringify(fundingPayload, null, 2)}\n`, "utf8"),
    ]);
  }
  return { date: today, jobs: jobsResult.summary, funding: fundingResult.summary, wroteFiles: write };
}

const isEntryPoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) {
  const summary = await refreshTracker({ write: !process.argv.includes("--dry-run") });
  console.log(JSON.stringify(summary, null, 2));
  if (summary.jobs.active === 0 || summary.funding.kept === 0) throw new Error("Refresh would leave no active public opportunities");
}

export { daysUntil, isDefinitelyClosed, postingAgeStatus, priorityScore, refreshFunding, refreshJobs, refreshTracker, todayInTimezone };
