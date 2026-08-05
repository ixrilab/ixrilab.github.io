import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const jobsUrl = new URL("../data/jobs.json", import.meta.url);
const fundingUrl = new URL("../data/funding.json", import.meta.url);
const sourcesUrl = new URL("../data-tools/funding-sources.json", import.meta.url);
const indexUrl = new URL("../index.html", import.meta.url);
const appUrl = new URL("../app.js", import.meta.url);

const [jobsRaw, fundingRaw, sourcesRaw, indexRaw, appRaw] = await Promise.all([
  readFile(jobsUrl, "utf8"),
  readFile(fundingUrl, "utf8"),
  readFile(sourcesUrl, "utf8"),
  readFile(indexUrl, "utf8"),
  readFile(appUrl, "utf8"),
]);

const jobsPayload = JSON.parse(jobsRaw);
const fundingPayload = JSON.parse(fundingRaw);
const sourcesPayload = JSON.parse(sourcesRaw);

assert.equal(jobsPayload.timezone, "Australia/Sydney");
assert.ok(Array.isArray(jobsPayload.jobs) && jobsPayload.jobs.length > 0, "jobs must be a non-empty array");
assert.equal(fundingPayload.timezone, "Australia/Sydney");
assert.ok(Array.isArray(fundingPayload.opportunities) && fundingPayload.opportunities.length > 0, "funding opportunities must be a non-empty array");
assert.equal(sourcesPayload.timezone, "Australia/Sydney");
assert.ok(Array.isArray(sourcesPayload.sources) && sourcesPayload.sources.length >= 15, "funding source registry is incomplete");

const inactivePattern = /closed|expired|ineligible|excluded/i;
const privatePattern = /[A-Z]:\\Users\\|OneDrive|@(gmail|hotmail|outlook)\.com/i;
const hangulPattern = /[가-힣]/;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const allowedFundingStatuses = new Set(["Open", "Rolling", "Conditional", "Monitoring"]);
const allowedFundingCategories = new Set(["Australia", "Korea-Australia", "Corporate"]);
const allowedConfidence = new Set(["High", "Medium", "Low"]);

const jobIds = new Set();
for (const [index, job] of jobsPayload.jobs.entries()) {
  for (const field of ["id", "institution", "title", "category", "location", "status", "url", "checkedAt", "salary", "salaryBasis", "salaryConfidence"]) {
    assert.ok(job[field], `jobs[${index}].${field} is required`);
  }
  assert.ok(!jobIds.has(job.id), `jobs[${index}].id must be unique`);
  jobIds.add(job.id);
  assert.match(job.url, /^https:\/\//, `jobs[${index}].url must use HTTPS`);
  assert.match(job.checkedAt, isoDatePattern, `jobs[${index}].checkedAt must be ISO date`);
  assert.ok(Number.isFinite(job.score), `jobs[${index}].score must be numeric`);
  assert.doesNotMatch(`${job.category} ${job.status}`, inactivePattern, `jobs[${index}] is inactive`);
}

for (let index = 1; index < jobsPayload.jobs.length; index += 1) {
  assert.ok(jobsPayload.jobs[index - 1].score >= jobsPayload.jobs[index].score, "jobs must be sorted by descending priority score");
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

const publicText = [jobsRaw, fundingRaw, sourcesRaw, indexRaw, appRaw].join("\n");
assert.doesNotMatch(publicText, privatePattern, "public files contain a prohibited personal or local identifier");
assert.doesNotMatch(publicText, hangulPattern, "public UI and datasets must be English-only");
assert.match(indexRaw, /role="tablist"/, "page must expose an accessible tab list");
assert.match(indexRaw, /id="jobs-panel"/, "jobs panel is missing");
assert.match(indexRaw, /id="funding-panel"/, "funding panel is missing");
assert.match(appRaw, /data\/funding\.json/, "funding data is not wired into the application");

console.log(JSON.stringify({
  jobs: jobsPayload.jobs.length,
  faculty: jobsPayload.jobs.filter((job) => job.category === "Faculty").length,
  funding: fundingPayload.opportunities.length,
  actionableFunding: fundingPayload.opportunities.filter((item) => ["Open", "Rolling"].includes(item.status)).length,
  fundingSources: sourcesPayload.sources.length,
  checkedAt: [...new Set([
    ...jobsPayload.jobs.map((job) => job.checkedAt),
    ...fundingPayload.opportunities.map((item) => item.checkedAt),
  ])],
  status: "valid",
}, null, 2));
