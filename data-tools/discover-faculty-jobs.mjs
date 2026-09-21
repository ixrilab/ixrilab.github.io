import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const SOURCES_URL = new URL("./faculty-discovery-sources.json", import.meta.url);
const JOBS_URL = new URL("../data/jobs.json", import.meta.url);
const OUTPUT_URL = new URL("../data/faculty-discovery.json", import.meta.url);
const REQUEST_TIMEOUT_MS = 25_000;

const APPOINTMENT_PATTERN = /(?:tenure[- ]track|tenured|assistant professor|associate professor|open[- ]rank|faculty position)/i;
const EXCLUDED_APPOINTMENT_PATTERN = /(?:professional[- ]track|professor of instruction|teaching|lecturer|adjunct|visiting|postdoc|postdoctoral|research (?:assistant|associate )?professor|research scientist|clinical)/i;
const RESEARCH_SIGNALS = [
  ["HCI", /human[- ]computer interaction|\bHCI\b/i],
  ["human-AI interaction", /human[- ]AI (?:interaction|collaboration|teaming)|human[- ]centered AI|human[- ]centred AI/i],
  ["XR/VR/AR", /\b(?:XR|VR|AR)\b|virtual reality|augmented reality|extended reality|mixed reality/i],
  ["spatial computing", /spatial computing|3D user interface|immersive (?:computing|media|interaction|environment)/i],
  ["interactive systems", /interactive systems|intelligent user interface|AI interface|user experience/i],
  ["embodied/ubiquitous", /embodied interaction|ubiquitous computing|pervasive computing/i],
  ["technology-rich human collaboration", /collaboration technolog|digital technolog.{0,120}(?:human|work|organization)|AI and automation|trust in AI/i],
];

function todayInTimezone(now, timezone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function stripHtml(value = "") {
  return value.replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}

function matchedSignals(text) {
  return RESEARCH_SIGNALS.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
}

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        "User-Agent": "IXRILab-Faculty-Discovery/1.0 (+https://ixrilab.com/)",
        ...(options.headers || {}),
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function algoliaCredentials(source, fetcher = fetchText) {
  const page = await fetcher(source.url);
  const scriptPath = page.match(/<script[^>]+src="([^"]*main-es2015[^"]+\.js)"/i)?.[1];
  if (!scriptPath) throw new Error("main application script not found");
  const scriptUrl = new URL(scriptPath, source.url).href;
  const script = await fetcher(scriptUrl);
  const marker = `indexName:"${source.indexName}"`;
  const start = script.indexOf(marker);
  if (start === -1) throw new Error("search index configuration not found");
  const configuration = script.slice(start, start + 600);
  const credentials = configuration.match(/searchClient:\w+\(\)\("([A-Z0-9]+)","([a-zA-Z0-9]+)"\)/);
  if (!credentials || credentials[1] !== source.applicationId) throw new Error("public search credentials not found");
  return { applicationId: credentials[1], apiKey: credentials[2] };
}

async function scanAlgoliaSource(source, fetcher = fetchText) {
  const credentials = await algoliaCredentials(source, fetcher);
  const endpoint = `https://${credentials.applicationId}-dsn.algolia.net/1/indexes/${source.indexName}/query`;
  const body = JSON.stringify({
    params: "query=&hitsPerPage=1000&attributesToRetrieve=objectID,name,description,unit_name,unit_ancestry,close_date_display,legacy_position_id&attributesToHighlight=&attributesToSnippet=",
  });
  const raw = await fetcher(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Algolia-Application-Id": credentials.applicationId,
      "X-Algolia-API-Key": credentials.apiKey,
    },
    body,
  });
  const payload = JSON.parse(raw);
  return (payload.hits || []).map((hit) => {
    const title = String(hit.name || "").trim();
    const text = stripHtml(`${title} ${hit.description || ""}`);
    return {
      sourceId: source.id,
      sourceJobId: String(hit.objectID),
      institution: source.institution,
      title,
      unit: hit.unit_name || hit.unit_ancestry || "Unit not stated",
      officialUrl: new URL(`/career/${hit.objectID}`, source.url).href,
      deadlineLabel: hit.close_date_display || "Open until filled",
      matchedSignals: matchedSignals(text),
      eligibleAppointment: APPOINTMENT_PATTERN.test(text) && !EXCLUDED_APPOINTMENT_PATTERN.test(title),
    };
  });
}

async function discoverFacultyJobs({ now = new Date(), fetcher = fetchText, write = true } = {}) {
  const [registry, jobsPayload] = await Promise.all([
    readFile(SOURCES_URL, "utf8").then(JSON.parse),
    readFile(JOBS_URL, "utf8").then(JSON.parse),
  ]);
  const knownUrls = new Map(jobsPayload.jobs.map((job) => [job.officialUrl.replace(/\/$/, ""), job.id]));
  const candidates = [];
  const sourcesChecked = [];

  for (const source of registry.sources) {
    try {
      const hits = source.type === "algolia-angular" ? await scanAlgoliaSource(source, fetcher) : [];
      const relevant = hits.filter((hit) => hit.eligibleAppointment && hit.matchedSignals.length > 0);
      for (const hit of relevant) {
        const knownJobId = knownUrls.get(hit.officialUrl.replace(/\/$/, "")) || null;
        candidates.push({
          ...hit,
          reviewStatus: knownJobId ? "Tracked" : "Needs review",
          knownJobId,
        });
      }
      sourcesChecked.push({
        id: source.id,
        institution: source.institution,
        checkedAt: todayInTimezone(now, registry.timezone),
        status: "Verified",
        postingsInspected: hits.length,
        candidatesFound: relevant.length,
      });
    } catch (error) {
      sourcesChecked.push({
        id: source.id,
        institution: source.institution,
        checkedAt: todayInTimezone(now, registry.timezone),
        status: "Failed",
        detail: String(error?.message || error),
      });
    }
  }

  candidates.sort((a, b) => a.reviewStatus.localeCompare(b.reviewStatus) || a.institution.localeCompare(b.institution) || a.title.localeCompare(b.title));
  const output = { generatedAt: now.toISOString(), timezone: registry.timezone, sourcesChecked, candidates };
  if (write) await writeFile(OUTPUT_URL, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  return output;
}

const isEntryPoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) {
  const output = await discoverFacultyJobs({ write: !process.argv.includes("--dry-run") });
  console.log(JSON.stringify({
    sources: output.sourcesChecked,
    tracked: output.candidates.filter((item) => item.reviewStatus === "Tracked").length,
    needsReview: output.candidates.filter((item) => item.reviewStatus === "Needs review").length,
  }, null, 2));
  if (output.sourcesChecked.some((source) => source.status === "Failed")) process.exitCode = 1;
}

export { discoverFacultyJobs, matchedSignals, scanAlgoliaSource, stripHtml };
