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
        "User-Agent": "IXRILab-Opportunity-Tracker/1.0 (+https://ixrilab.com/)",
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

async function refreshCollection(items, { today, kind, inspect = inspectUrl }) {
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
      summary.warnings.push(`${kind}:${item.id}: ${result.detail}`);
    }

    if (kind === "job") refreshed.daysLeft = daysUntil(refreshed.deadline, today);
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
    refreshCollection(jobsPayload.jobs, { today, kind: "job", inspect }),
    refreshCollection(fundingPayload.opportunities, { today, kind: "funding", inspect }),
  ]);

  jobsPayload.generatedAt = now.toISOString();
  jobsPayload.jobs = jobsResult.items.sort((a, b) => b.score - a.score || (b.workbookScore ?? 0) - (a.workbookScore ?? 0));
  fundingPayload.generatedAt = now.toISOString();
  fundingPayload.opportunities = fundingResult.items.sort((a, b) => b.score - a.score);

  if (write) {
    await Promise.all([
      writeFile(JOBS_URL, `${JSON.stringify(jobsPayload, null, 2)}\n`, "utf8"),
      writeFile(FUNDING_URL, `${JSON.stringify(fundingPayload, null, 2)}\n`, "utf8"),
    ]);
  }

  return {
    date: today,
    jobs: jobsResult.summary,
    funding: fundingResult.summary,
    wroteFiles: write,
  };
}

const isEntryPoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) {
  const summary = await refreshTracker({ write: !process.argv.includes("--dry-run") });
  console.log(JSON.stringify(summary, null, 2));
  if (summary.jobs.kept === 0 || summary.funding.kept === 0) {
    throw new Error("Refresh would leave a public dataset empty");
  }
}

export { daysUntil, isDefinitelyClosed, refreshCollection, refreshTracker, todayInTimezone };
