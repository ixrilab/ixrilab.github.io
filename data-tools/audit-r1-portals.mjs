import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const JOBS_URL = new URL("../data/jobs.json", import.meta.url);
const DISCOVERY_SOURCES_URL = new URL("./faculty-discovery-sources.json", import.meta.url);
const DISCOVERY_AUDIT_URL = new URL("../data/faculty-discovery.json", import.meta.url);
const COVERAGE_URL = new URL("../data/r1-coverage.json", import.meta.url);
const SEARCH_SCOPE_URL = new URL("./r1-search-scope.json", import.meta.url);
const TIMEZONE = "Australia/Sydney";
const EXPECTED_R1_COUNT = 187;
const CARNEGIE_SEARCH_URL = "https://carnegieclassifications.acenet.edu/institutions/?research2025%5B0%5D=1";
const REQUEST_TIMEOUT_MS = 25_000;

const JOB_NAME_ALIASES = {
  "Cornell University (Weill Cornell Medicine)": "weill-medical-college-of-cornell-university",
  "Texas A&M University": "texas-am-university-college-station",
  "University at Buffalo, SUNY": "university-at-buffalo",
  "University of Alabama": "the-university-of-alabama",
  "University of California, Berkeley": "university-of-california-berkeley",
  "University of California, Irvine": "university-of-california-irvine",
  "University of Tennessee, Knoxville": "the-university-of-tennessee-knoxville",
  "University of Washington": "university-of-washington-seattle-campus",
};

function todayInTimezone(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function decodeHtml(value = "") {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#0*38;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&ndash;|&#8211;/g, "–")
    .replace(/&mdash;|&#8212;/g, "—")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCarnegieInstitutions(html) {
  const institutions = [];
  const rowPattern = /<td class="institution-title">[\s\S]*?<a href="([^"]+\/institution\/([^/]+)\/)">([\s\S]*?)<\/a>[\s\S]*?<span class="institution-city">([\s\S]*?)<\/span>,[\s\S]*?<span class="institution-state">([\s\S]*?)<\/span>/g;
  for (const match of html.matchAll(rowPattern)) {
    institutions.push({
      slug: match[2],
      name: decodeHtml(match[3]),
      city: decodeHtml(match[4]),
      state: decodeHtml(match[5]),
      carnegieUrl: match[1],
    });
  }
  return institutions;
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "IXRILab-R1-Coverage-Audit/1.0 (+https://ixrilab.com/)",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCarnegieR1(fetcher = fetchText) {
  const pages = await Promise.all(Array.from({ length: 8 }, (_, index) => {
    const page = index + 1;
    const url = page === 1
      ? CARNEGIE_SEARCH_URL
      : `https://carnegieclassifications.acenet.edu/institutions/page/${page}/?research2025%5B0%5D=1`;
    return fetcher(url);
  }));
  const institutions = pages.flatMap(parseCarnegieInstitutions);
  const unique = new Map(institutions.map((institution) => [institution.slug, institution]));
  if (unique.size !== EXPECTED_R1_COUNT) {
    throw new Error(`Expected ${EXPECTED_R1_COUNT} R1 institutions, found ${unique.size}`);
  }
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function normalizedSlug(name) {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function resolveJobInstitution(job, institutionsBySlug) {
  const explicit = JOB_NAME_ALIASES[job.university];
  if (explicit && institutionsBySlug.has(explicit)) return explicit;
  const normalized = normalizedSlug(job.university);
  if (institutionsBySlug.has(normalized)) return normalized;
  return [...institutionsBySlug.keys()].find((slug) => slug === normalized.replace(/^the-/, "") || slug.replace(/^the-/, "") === normalized) || null;
}

function scopeForInstitution(slug, searchScope) {
  const status = searchScope.core.includes(slug)
    ? "Core"
    : searchScope.directFitOnly.includes(slug)
      ? "Direct-fit only"
      : "Excluded";
  return { searchScope: status, scopeReason: searchScope.reasons[status] };
}

function buildCoverage({ institutions, jobs, sources, discoveryAudit, searchScope, now = new Date(), sourceSync }) {
  const checkedAt = todayInTimezone(now);
  const institutionsBySlug = new Map(institutions.map((institution) => [institution.slug, institution]));
  const jobsBySlug = new Map();
  for (const job of jobs.filter((item) => item.country === "United States")) {
    const slug = resolveJobInstitution(job, institutionsBySlug);
    if (!slug) continue;
    if (!jobsBySlug.has(slug)) jobsBySlug.set(slug, []);
    jobsBySlug.get(slug).push({ id: job.id, title: job.title, officialUrl: job.officialUrl, status: job.status });
  }

  const sourceBySlug = new Map(sources.filter((source) => source.carnegieSlug).map((source) => [source.carnegieSlug, source]));
  const auditBySourceId = new Map(discoveryAudit.sourcesChecked.map((source) => [source.id, source]));

  const coverage = institutions.map((institution) => {
    const source = sourceBySlug.get(institution.slug);
    const audit = source ? auditBySourceId.get(source.id) : null;
    const trackedJobs = jobsBySlug.get(institution.slug) || [];
    const operational = Boolean(source && audit?.status === "Verified");
    const failed = Boolean(source && audit?.status === "Failed");
    return {
      ...institution,
      ...scopeForInstitution(institution.slug, searchScope),
      coverageLevel: operational ? "Full portal scan" : trackedJobs.length ? "Tracked postings only" : "No portal adapter",
      adapterStatus: operational ? "Operational" : failed ? "Failed" : "Needs adapter",
      adapterType: source?.type || null,
      portalUrl: source?.url || null,
      sourceId: source?.id || null,
      lastChecked: audit?.checkedAt || null,
      postingsInspected: audit?.postingsInspected ?? null,
      candidatesFound: audit?.candidatesFound ?? null,
      trackedJobs,
    };
  });

  const summary = {
    registered: coverage.length,
    core: coverage.filter((item) => item.searchScope === "Core").length,
    directFitOnly: coverage.filter((item) => item.searchScope === "Direct-fit only").length,
    excluded: coverage.filter((item) => item.searchScope === "Excluded").length,
    fullPortalScan: coverage.filter((item) => item.coverageLevel === "Full portal scan").length,
    trackedPostingsOnly: coverage.filter((item) => item.coverageLevel === "Tracked postings only").length,
    noPortalAdapter: coverage.filter((item) => item.coverageLevel === "No portal adapter").length,
    operationalAdapters: coverage.filter((item) => item.adapterStatus === "Operational").length,
    failedAdapters: coverage.filter((item) => item.adapterStatus === "Failed").length,
  };

  return {
    generatedAt: now.toISOString(),
    timezone: TIMEZONE,
    source: {
      name: "2025 Carnegie Research Activity Designations",
      url: CARNEGIE_SEARCH_URL,
      expectedR1Count: EXPECTED_R1_COUNT,
      ...sourceSync,
      checkedAt,
    },
    summary,
    institutions: coverage,
  };
}

async function auditR1Portals({ now = new Date(), fetcher = fetchText, write = true } = {}) {
  const [jobsPayload, sourceRegistry, discoveryAudit, searchScope, priorCoverage] = await Promise.all([
    readFile(JOBS_URL, "utf8").then(JSON.parse),
    readFile(DISCOVERY_SOURCES_URL, "utf8").then(JSON.parse),
    readFile(DISCOVERY_AUDIT_URL, "utf8").then(JSON.parse),
    readFile(SEARCH_SCOPE_URL, "utf8").then(JSON.parse),
    readFile(COVERAGE_URL, "utf8").then(JSON.parse).catch(() => null),
  ]);

  let institutions;
  let sourceSync;
  try {
    institutions = await fetchCarnegieR1(fetcher);
    sourceSync = { status: "Verified", detail: "All eight official result pages matched the expected R1 count." };
  } catch (error) {
    if (!priorCoverage?.institutions?.length) throw error;
    institutions = priorCoverage.institutions.map(({ slug, name, city, state, carnegieUrl }) => ({ slug, name, city, state, carnegieUrl }));
    sourceSync = { status: "Failed", detail: `Retained the last verified registry: ${String(error?.message || error)}` };
  }

  const output = buildCoverage({
    institutions,
    jobs: jobsPayload.jobs,
    sources: sourceRegistry.sources,
    discoveryAudit,
    searchScope,
    now,
    sourceSync,
  });
  if (write) await writeFile(COVERAGE_URL, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  return output;
}

const isEntryPoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) {
  const output = await auditR1Portals({ write: !process.argv.includes("--dry-run") });
  console.log(JSON.stringify({ source: output.source, summary: output.summary }, null, 2));
}

export { auditR1Portals, buildCoverage, fetchCarnegieR1, parseCarnegieInstitutions, resolveJobInstitution, scopeForInstitution };
