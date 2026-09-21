import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const jobsUrl = new URL("../data/jobs.json", import.meta.url);
const fundingUrl = new URL("../data/funding.json", import.meta.url);
const sourcesUrl = new URL("../data-tools/funding-sources.json", import.meta.url);
const facultyDiscoverySourcesUrl = new URL("../data-tools/faculty-discovery-sources.json", import.meta.url);
const facultyDiscoveryUrl = new URL("../data/faculty-discovery.json", import.meta.url);
const r1CoverageUrl = new URL("../data/r1-coverage.json", import.meta.url);
const r1SearchScopeUrl = new URL("../data-tools/r1-search-scope.json", import.meta.url);
const policyUrl = new URL("../data-tools/faculty-search-policy.json", import.meta.url);
const indexUrl = new URL("../index.html", import.meta.url);
const appUrl = new URL("../app.js", import.meta.url);

const [jobsRaw, fundingRaw, sourcesRaw, facultyDiscoverySourcesRaw, facultyDiscoveryRaw, r1CoverageRaw, r1SearchScopeRaw, policyRaw, indexRaw, appRaw] = await Promise.all([
  readFile(jobsUrl, "utf8"),
  readFile(fundingUrl, "utf8"),
  readFile(sourcesUrl, "utf8"),
  readFile(facultyDiscoverySourcesUrl, "utf8"),
  readFile(facultyDiscoveryUrl, "utf8"),
  readFile(r1CoverageUrl, "utf8"),
  readFile(r1SearchScopeUrl, "utf8"),
  readFile(policyUrl, "utf8"),
  readFile(indexUrl, "utf8"),
  readFile(appUrl, "utf8"),
]);

const jobsPayload = JSON.parse(jobsRaw);
const fundingPayload = JSON.parse(fundingRaw);
const sourcesPayload = JSON.parse(sourcesRaw);
const facultyDiscoverySources = JSON.parse(facultyDiscoverySourcesRaw);
const facultyDiscovery = JSON.parse(facultyDiscoveryRaw);
const r1Coverage = JSON.parse(r1CoverageRaw);
const r1SearchScope = JSON.parse(r1SearchScopeRaw);
const policy = JSON.parse(policyRaw);

assert.equal(jobsPayload.timezone, "Australia/Sydney");
assert.ok(Array.isArray(jobsPayload.jobs) && jobsPayload.jobs.length > 0, "jobs must be a non-empty array");
assert.equal(fundingPayload.timezone, "Australia/Sydney");
assert.ok(Array.isArray(fundingPayload.opportunities) && fundingPayload.opportunities.length > 0, "funding opportunities must be a non-empty array");
assert.equal(sourcesPayload.timezone, "Australia/Sydney");
assert.ok(Array.isArray(sourcesPayload.sources) && sourcesPayload.sources.length >= 15, "funding source registry is incomplete");
assert.equal(facultyDiscoverySources.timezone, "Australia/Sydney");
assert.ok(Array.isArray(facultyDiscoverySources.sources) && facultyDiscoverySources.sources.length > 0, "faculty discovery source registry is empty");
assert.equal(facultyDiscovery.timezone, "Australia/Sydney");
assert.ok(Array.isArray(facultyDiscovery.sourcesChecked), "faculty discovery audit is missing");
assert.ok(Array.isArray(facultyDiscovery.candidates), "faculty discovery candidates are missing");
assert.equal(r1Coverage.timezone, "Australia/Sydney");
assert.equal(r1Coverage.source.expectedR1Count, 187);
assert.equal(r1Coverage.summary.registered, 187);
assert.ok(Array.isArray(r1Coverage.institutions) && r1Coverage.institutions.length === 187, "R1 coverage registry must contain all 187 institutions");

const privatePattern = /[A-Z]:\\Users\\|OneDrive|@(gmail|hotmail|outlook)\.com/i;
const hangulPattern = /[가-힣]/;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const allowedFundingStatuses = new Set(["Open", "Rolling", "Conditional", "Monitoring"]);
const allowedFundingCategories = new Set(["Australia", "Korea-Australia", "Corporate"]);
const allowedConfidence = new Set(["High", "Medium", "Low"]);
const allowedJobStatuses = new Set(["Open", "Rolling", "Closed"]);
const allowedFitLevels = new Set(["Direct", "Strong", "Broad"]);
const allowedAgeStatuses = new Set(["Under 6 months", "Older than 6 months — reconfirm", "Date unavailable"]);
const institutionWeights = { Exceptional: 8, "Very Strong": 5, Strong: 3 };
const allowedCountries = new Set(Object.keys(policy.geography));
const nonUsInstitutions = new Map(
  Object.entries(policy.geography)
    .filter(([, rules]) => rules.institutions)
    .map(([country, rules]) => [country, new Set(rules.institutions)]),
);

const jobIds = new Set();
const jobOfficialUrls = new Set();
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
  assert.ok(!jobOfficialUrls.has(job.officialUrl), `jobs[${index}].officialUrl must be unique`);
  jobOfficialUrls.add(job.officialUrl);
  assert.ok(allowedCountries.has(job.country), `jobs[${index}].country is outside policy`);
  assert.ok(allowedJobStatuses.has(job.status), `jobs[${index}].status is unsupported`);
  assert.ok(allowedFitLevels.has(job.fitLevel), `jobs[${index}].fitLevel is unsupported`);
  assert.ok(allowedAgeStatuses.has(job.postingAgeStatus), `jobs[${index}].postingAgeStatus is unsupported`);
  assert.match(job.officialUrl, /^https:\/\//, `jobs[${index}].officialUrl must use HTTPS`);
  assert.match(job.firstSeen, isoDatePattern, `jobs[${index}].firstSeen must be ISO date`);
  assert.match(job.lastVerified, isoDatePattern, `jobs[${index}].lastVerified must be ISO date`);
  assert.ok(Number.isFinite(job.priorityScore), `jobs[${index}].priorityScore must be numeric`);
  assert.ok(job.priorityScore >= 0 && job.priorityScore <= 100, `jobs[${index}].priorityScore must be on a 100-point scale`);
  assert.ok(Number.isFinite(job.institutionScore), `jobs[${index}].institutionScore must be numeric`);
  assert.ok(job.institutionScore >= 0 && job.institutionScore <= 8, `jobs[${index}].institutionScore exceeds its weight`);
  assert.equal(job.institutionScore, institutionWeights[job.institutionStrength], `jobs[${index}].institutionScore does not match its strength tier`);
  assert.ok(Number.isFinite(job.collaborationEvidenceScore), `jobs[${index}].collaborationEvidenceScore must be numeric`);
  assert.ok(job.collaborationEvidenceScore >= 0 && job.collaborationEvidenceScore <= 180, `jobs[${index}].collaborationEvidenceScore is invalid`);
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
  if (job.recentFacultySignals) {
    assert.ok(Array.isArray(job.recentFacultySignals) && job.recentFacultySignals.length > 0, `jobs[${index}].recentFacultySignals must be a non-empty array`);
    for (const [facultyIndex, person] of job.recentFacultySignals.entries()) {
      for (const field of ["name", "joined", "strengthSignal", "barInference", "sourceUrl"]) {
        assert.ok(person[field], `jobs[${index}].recentFacultySignals[${facultyIndex}].${field} is required`);
      }
      assert.match(person.sourceUrl, /^https:\/\//, `jobs[${index}] recent-hire source URL must use HTTPS`);
    }
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

for (const id of ["ut-austin-ischool-open-rank-191973", "berkeley-ischool-hci-jpf05482", "uci-informatics-hci-jpf10388"]) {
  const job = jobsPayload.jobs.find((item) => item.id === id);
  assert.ok(job?.recentFacultySignals?.length, `${id} must include recent-hire bar signals`);
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

const facultySourceIds = new Set();
for (const [index, source] of facultyDiscoverySources.sources.entries()) {
  for (const field of ["id", "institution", "country", "type", "url", "lastManualAudit"]) {
    assert.ok(source[field], `faculty discovery sources[${index}].${field} is required`);
  }
  assert.ok(!facultySourceIds.has(source.id), `faculty discovery source id ${source.id} is duplicated`);
  facultySourceIds.add(source.id);
  assert.match(source.url, /^https:\/\//, `faculty discovery sources[${index}].url must use HTTPS`);
  assert.match(source.lastManualAudit, isoDatePattern, `faculty discovery sources[${index}].lastManualAudit must be ISO date`);
}

const allowedCoverageLevels = new Set(["Full portal scan", "Tracked postings only", "No portal adapter"]);
const allowedAdapterStatuses = new Set(["Operational", "Failed", "Needs adapter"]);
const allowedSearchScopes = new Set(["Core", "Direct-fit only", "Excluded"]);
const r1Slugs = new Set();
for (const [index, institution] of r1Coverage.institutions.entries()) {
  for (const field of ["slug", "name", "city", "state", "carnegieUrl", "searchScope", "scopeReason", "coverageLevel", "adapterStatus"]) {
    assert.ok(institution[field], `R1 coverage institutions[${index}].${field} is required`);
  }
  assert.ok(!r1Slugs.has(institution.slug), `R1 coverage slug ${institution.slug} is duplicated`);
  r1Slugs.add(institution.slug);
  assert.match(institution.carnegieUrl, /^https:\/\/carnegieclassifications\.acenet\.edu\/institution\//, `R1 coverage institutions[${index}] must use an official Carnegie URL`);
  assert.ok(allowedCoverageLevels.has(institution.coverageLevel), `R1 coverage institutions[${index}].coverageLevel is unsupported`);
  assert.ok(allowedAdapterStatuses.has(institution.adapterStatus), `R1 coverage institutions[${index}].adapterStatus is unsupported`);
  assert.ok(allowedSearchScopes.has(institution.searchScope), `R1 coverage institutions[${index}].searchScope is unsupported`);
  assert.ok(Array.isArray(institution.trackedJobs), `R1 coverage institutions[${index}].trackedJobs is required`);
  if (institution.coverageLevel === "Full portal scan") {
    assert.equal(institution.adapterStatus, "Operational", `R1 coverage institutions[${index}] full scan must be operational`);
    assert.ok(institution.postingsInspected >= 0, `R1 coverage institutions[${index}] full scan needs evidence`);
  }
}
assert.equal(r1Coverage.summary.fullPortalScan, r1Coverage.institutions.filter((item) => item.coverageLevel === "Full portal scan").length);
assert.equal(r1Coverage.summary.trackedPostingsOnly, r1Coverage.institutions.filter((item) => item.coverageLevel === "Tracked postings only").length);
assert.equal(r1Coverage.summary.noPortalAdapter, r1Coverage.institutions.filter((item) => item.coverageLevel === "No portal adapter").length);
assert.equal(r1Coverage.summary.core, r1Coverage.institutions.filter((item) => item.searchScope === "Core").length);
assert.equal(r1Coverage.summary.directFitOnly, r1Coverage.institutions.filter((item) => item.searchScope === "Direct-fit only").length);
assert.equal(r1Coverage.summary.excluded, r1Coverage.institutions.filter((item) => item.searchScope === "Excluded").length);
assert.equal(new Set([...r1SearchScope.core, ...r1SearchScope.directFitOnly]).size, r1SearchScope.core.length + r1SearchScope.directFitOnly.length, "R1 scope lists must not overlap");
for (const slug of [...r1SearchScope.core, ...r1SearchScope.directFitOnly]) assert.ok(r1Slugs.has(slug), `R1 scope slug ${slug} is not in the Carnegie registry`);
for (const source of facultyDiscoverySources.sources) {
  assert.ok(r1Slugs.has(source.carnegieSlug), `Faculty discovery source ${source.id} must identify its Carnegie institution`);
  assert.notEqual(r1Coverage.institutions.find((item) => item.slug === source.carnegieSlug)?.searchScope, "Excluded", `Faculty discovery source ${source.id} is outside the active search scope`);
}

const publicText = [jobsRaw, fundingRaw, sourcesRaw, facultyDiscoverySourcesRaw, facultyDiscoveryRaw, r1CoverageRaw, r1SearchScopeRaw, policyRaw, indexRaw, appRaw].join("\n");
assert.doesNotMatch(publicText, privatePattern, "public files contain a prohibited personal or local identifier");
assert.doesNotMatch(publicText, hangulPattern, "public UI and datasets must be English-only");
assert.match(indexRaw, /role="tablist"/, "page must expose an accessible tab list");
assert.match(indexRaw, /id="jobs-panel"/, "jobs panel is missing");
assert.match(indexRaw, /id="funding-panel"/, "funding panel is missing");
assert.match(indexRaw, /id="coverage-panel"/, "coverage panel is missing");
assert.match(appRaw, /data\/funding\.json/, "funding data is not wired into the application");
assert.match(appRaw, /job\.status !== "Closed"/, "the public summary must distinguish active from closed jobs");
assert.match(appRaw, /collaborationFaculty/, "faculty collaboration evidence is not wired into the application");
assert.match(appRaw, /postingAgeStatus/, "six-month posting-age warnings are not wired into the application");
assert.match(appRaw, /data\/r1-coverage\.json/, "R1 coverage data is not wired into the application");
assert.match(appRaw, /filter\(\(item\) => !hasPassedDeadline\(item\)\)/, "funding must be filtered against the current date in the browser");

console.log(JSON.stringify({
  jobs: jobsPayload.jobs.length,
  activeFaculty: jobsPayload.jobs.filter((job) => job.status !== "Closed").length,
  directFit: jobsPayload.jobs.filter((job) => job.status !== "Closed" && job.fitLevel === "Direct").length,
  funding: fundingPayload.opportunities.length,
  actionableFunding: fundingPayload.opportunities.filter((item) => ["Open", "Rolling"].includes(item.status)).length,
  fundingSources: sourcesPayload.sources.length,
  facultyDiscoverySources: facultyDiscoverySources.sources.length,
  facultyCandidates: facultyDiscovery.candidates.length,
  r1Institutions: r1Coverage.institutions.length,
  fullPortalScans: r1Coverage.summary.fullPortalScan,
  checkedAt: [...new Set([
    ...jobsPayload.jobs.map((job) => job.lastVerified),
    ...fundingPayload.opportunities.map((item) => item.checkedAt),
  ])],
  status: "valid",
}, null, 2));
