import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const jobsUrl = new URL("../data/jobs.json", import.meta.url);
const fundingUrl = new URL("../data/funding.json", import.meta.url);
const sourcesUrl = new URL("../data-tools/funding-sources.json", import.meta.url);
const policyUrl = new URL("../data-tools/faculty-search-policy.json", import.meta.url);
const indexUrl = new URL("../index.html", import.meta.url);
const appUrl = new URL("../app.js", import.meta.url);

const [jobsRaw, fundingRaw, sourcesRaw, policyRaw, indexRaw, appRaw] = await Promise.all([
  readFile(jobsUrl, "utf8"),
  readFile(fundingUrl, "utf8"),
  readFile(sourcesUrl, "utf8"),
  readFile(policyUrl, "utf8"),
  readFile(indexUrl, "utf8"),
  readFile(appUrl, "utf8"),
]);

const jobsPayload = JSON.parse(jobsRaw);
const fundingPayload = JSON.parse(fundingRaw);
const sourcesPayload = JSON.parse(sourcesRaw);
const policy = JSON.parse(policyRaw);

assert.equal(jobsPayload.timezone, "Australia/Sydney");
assert.ok(Array.isArray(jobsPayload.jobs) && jobsPayload.jobs.length > 0, "jobs must be a non-empty array");
assert.equal(fundingPayload.timezone, "Australia/Sydney");
assert.ok(Array.isArray(fundingPayload.opportunities) && fundingPayload.opportunities.length > 0, "funding opportunities must be a non-empty array");
assert.equal(sourcesPayload.timezone, "Australia/Sydney");
assert.ok(Array.isArray(sourcesPayload.sources) && sourcesPayload.sources.length >= 15, "funding source registry is incomplete");

const privatePattern = /[A-Z]:\\Users\\|OneDrive|@(gmail|hotmail|outlook)\.com/i;
const hangulPattern = /[가-힣]/;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const allowedFundingStatuses = new Set(["Open", "Rolling", "Conditional", "Monitoring"]);
const allowedFundingCategories = new Set(["Australia", "Korea-Australia", "Corporate"]);
const allowedConfidence = new Set(["High", "Medium", "Low"]);
const allowedJobStatuses = new Set(["Open", "Rolling", "Closed"]);
const allowedFitLevels = new Set(["Direct", "Strong", "Broad"]);
const allowedAgeStatuses = new Set(["Under 6 months", "Older than 6 months — reconfirm", "Date unavailable"]);
const allowedCountries = new Set(Object.keys(policy.geography));
const nonUsInstitutions = new Map(
  Object.entries(policy.geography)
    .filter(([, rules]) => rules.institutions)
    .map(([country, rules]) => [country, new Set(rules.institutions)]),
);

const jobIds = new Set();
for (const [index, job] of jobsPayload.jobs.entries()) {
  for (const field of [
    "id",
    "country",
    "university",
    "department",
    "title",
    "rankTrack",
    "researchArea",
    "status",
    "officialUrl",
    "fitLevel",
    "fitNote",
    "institutionStrength",
    "firstSeen",
    "lastVerified",
    "changeType",
    "postingAgeStatus",
  ]) {
    assert.ok(job[field], `jobs[${index}].${field} is required`);
  }
  assert.ok(!jobIds.has(job.id), `jobs[${index}].id must be unique`);
  jobIds.add(job.id);
  assert.ok(allowedCountries.has(job.country), `jobs[${index}].country is outside policy`);
  assert.ok(allowedJobStatuses.has(job.status), `jobs[${index}].status is unsupported`);
  assert.ok(allowedFitLevels.has(job.fitLevel), `jobs[${index}].fitLevel is unsupported`);
  assert.ok(allowedAgeStatuses.has(job.postingAgeStatus), `jobs[${index}].postingAgeStatus is unsupported`);
  assert.match(job.officialUrl, /^https:\/\//, `jobs[${index}].officialUrl must use HTTPS`);
  assert.match(job.firstSeen, isoDatePattern, `jobs[${index}].firstSeen must be ISO date`);
  assert.match(job.lastVerified, isoDatePattern, `jobs[${index}].lastVerified must be ISO date`);
  assert.ok(Number.isFinite(job.priorityScore), `jobs[${index}].priorityScore must be numeric`);
  assert.ok(Number.isFinite(job.institutionScore), `jobs[${index}].institutionScore must be numeric`);
  assert.ok(Number.isFinite(job.collaborationScore), `jobs[${index}].collaborationScore must be numeric`);
  assert.ok(job.priorityDate === null || isoDatePattern.test(job.priorityDate), `jobs[${index}].priorityDate must be null or ISO date`);
  assert.ok(job.finalDeadline === null || isoDatePattern.test(job.finalDeadline), `jobs[${index}].finalDeadline must be null or ISO date`);
  assert.ok(job.postedDate === null || isoDatePattern.test(job.postedDate), `jobs[${index}].postedDate must be null or ISO date`);
  assert.ok(Array.isArray(job.collaborationFaculty) && job.collaborationFaculty.length > 0, `jobs[${index}] needs evidenced collaboration faculty`);
  for (const [facultyIndex, person] of job.collaborationFaculty.entries()) {
    for (const field of ["name", "unitRelationship", "areas", "profileUrl"]) {
      assert.ok(person[field], `jobs[${index}].collaborationFaculty[${facultyIndex}].${field} is required`);
    }
    assert.match(person.profileUrl, /^https:\/\//, `jobs[${index}] collaborator URL must use HTTPS`);
  }
  if (job.country === "United States") {
    assert.equal(job.r1Verified, true, `jobs[${index}] US university must be R1-verified`);
  } else {
    assert.ok(nonUsInstitutions.get(job.country)?.has(job.university), `jobs[${index}].university is outside the country allowlist`);
  }
  if (/robot(?:ics|ic)/i.test(`${job.title} ${job.researchArea}`)) {
    assert.match(`${job.researchArea} ${job.fitNote}`, /human|interaction|HRI|XR|spatial/i, `jobs[${index}] is a pure robotics false positive`);
  }
}

for (let index = 1; index < jobsPayload.jobs.length; index += 1) {
  const previous = jobsPayload.jobs[index - 1];
  const current = jobsPayload.jobs[index];
  assert.ok(previous.status !== "Closed" || current.status === "Closed", "closed jobs must follow active jobs");
  if ((previous.status === "Closed") === (current.status === "Closed")) {
    assert.ok(previous.priorityScore >= current.priorityScore, "jobs must be sorted by descending evidence score within status");
  }
}

const fundingIds = new Set();
for (const [index, item] of fundingPayload.opportunities.entries()) {
  for (const field of [
    "id",
    "funder",
    "title",
    "regionCategory",
    "status",
    "deadlineLabel",
    "funding",
    "fundingType",
    "eligibilityRoute",
    "partnerRequirement",
    "fieldFit",
    "recommendation",
    "url",
    "checkedAt",
    "confidence",
  ]) {
    assert.ok(item[field], `opportunities[${index}].${field} is required`);
  }
  assert.ok(!fundingIds.has(item.id), `opportunities[${index}].id must be unique`);
  fundingIds.add(item.id);
  assert.ok(allowedFundingStatuses.has(item.status), `opportunities[${index}].status is unsupported`);
  assert.ok(allowedFundingCategories.has(item.regionCategory), `opportunities[${index}].regionCategory is unsupported`);
  assert.ok(allowedConfidence.has(item.confidence), `opportunities[${index}].confidence is unsupported`);
  assert.match(item.url, /^https:\/\//, `opportunities[${index}].url must use HTTPS`);
  assert.match(item.checkedAt, isoDatePattern, `opportunities[${index}].checkedAt must be ISO date`);
  assert.ok(Number.isFinite(item.score), `opportunities[${index}].score must be numeric`);
  if (item.deadline !== null) {
    assert.match(item.deadline, isoDatePattern, `opportunities[${index}].deadline must be null or ISO date`);
    assert.ok(item.deadline >= item.checkedAt, `opportunities[${index}] has a deadline before its verification date`);
  }
  if (["Rolling", "Monitoring"].includes(item.status)) {
    assert.equal(item.deadline, null, `opportunities[${index}] ${item.status} status must not have a fixed deadline`);
  }
}

for (let index = 1; index < fundingPayload.opportunities.length; index += 1) {
  assert.ok(
    fundingPayload.opportunities[index - 1].score >= fundingPayload.opportunities[index].score,
    "funding opportunities must be sorted by descending fit score",
  );
}

const sourceNames = new Set();
for (const [index, source] of sourcesPayload.sources.entries()) {
  for (const field of ["name", "category", "url", "queryHints"]) {
    assert.ok(source[field], `sources[${index}].${field} is required`);
  }
  assert.ok(!sourceNames.has(source.name), `sources[${index}].name must be unique`);
  sourceNames.add(source.name);
  assert.match(source.url, /^https:\/\//, `sources[${index}].url must use HTTPS`);
  assert.ok(Array.isArray(source.queryHints) && source.queryHints.length > 0, `sources[${index}].queryHints is required`);
}

const publicText = [jobsRaw, fundingRaw, sourcesRaw, policyRaw, indexRaw, appRaw].join("\n");
assert.doesNotMatch(publicText, privatePattern, "public files contain a prohibited personal or local identifier");
assert.doesNotMatch(publicText, hangulPattern, "public UI and datasets must be English-only");
assert.match(indexRaw, /role="tablist"/, "page must expose an accessible tab list");
assert.match(indexRaw, /id="jobs-panel"/, "jobs panel is missing");
assert.match(indexRaw, /id="funding-panel"/, "funding panel is missing");
assert.match(appRaw, /data\/funding\.json/, "funding data is not wired into the application");
assert.match(appRaw, /job\.status !== "Closed"/, "the public summary must distinguish active from closed jobs");
assert.match(appRaw, /collaborationFaculty/, "faculty collaboration evidence is not wired into the application");
assert.match(appRaw, /postingAgeStatus/, "six-month posting-age warnings are not wired into the application");
assert.match(appRaw, /filter\(\(item\) => !hasPassedDeadline\(item\)\)/, "funding must be filtered against the current date in the browser");

console.log(JSON.stringify({
  jobs: jobsPayload.jobs.length,
  activeFaculty: jobsPayload.jobs.filter((job) => job.status !== "Closed").length,
  directFit: jobsPayload.jobs.filter((job) => job.status !== "Closed" && job.fitLevel === "Direct").length,
  funding: fundingPayload.opportunities.length,
  actionableFunding: fundingPayload.opportunities.filter((item) => ["Open", "Rolling"].includes(item.status)).length,
  fundingSources: sourcesPayload.sources.length,
  checkedAt: [...new Set([
    ...jobsPayload.jobs.map((job) => job.lastVerified),
    ...fundingPayload.opportunities.map((item) => item.checkedAt),
  ])],
  status: "valid",
}, null, 2));
