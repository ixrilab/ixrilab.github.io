import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dataUrl = new URL("../data/jobs.json", import.meta.url);
const raw = await readFile(dataUrl, "utf8");
const payload = JSON.parse(raw);

assert.equal(payload.timezone, "Australia/Sydney");
assert.ok(Array.isArray(payload.jobs) && payload.jobs.length > 0, "jobs must be a non-empty array");

const inactivePattern = /종료|마감|조건 ?불충족|제외/i;
const privatePattern = /[A-Z]:\\Users\\|OneDrive|@(gmail|hotmail|outlook)\.com/i;

for (const [index, job] of payload.jobs.entries()) {
  for (const field of ["id", "institution", "title", "category", "location", "status", "url", "checkedAt", "salary", "salaryBasis", "salaryConfidence"]) {
    assert.ok(job[field], `jobs[${index}].${field} is required`);
  }
  assert.match(job.url, /^https:\/\//, `jobs[${index}].url must use HTTPS`);
  assert.match(job.checkedAt, /^\d{4}-\d{2}-\d{2}$/, `jobs[${index}].checkedAt must be ISO date`);
  assert.ok(Number.isFinite(job.score), `jobs[${index}].score must be numeric`);
  assert.doesNotMatch(`${job.category} ${job.status}`, inactivePattern, `jobs[${index}] is inactive`);
}

for (let index = 1; index < payload.jobs.length; index += 1) {
  assert.ok(payload.jobs[index - 1].score >= payload.jobs[index].score, "jobs must be sorted by descending priority score");
}

assert.doesNotMatch(raw, privatePattern, "dataset contains a prohibited personal or local identifier");

console.log(JSON.stringify({
  jobs: payload.jobs.length,
  faculty: payload.jobs.filter((job) => job.category === "교수").length,
  checkedAt: [...new Set(payload.jobs.map((job) => job.checkedAt))],
  status: "valid",
}, null, 2));
