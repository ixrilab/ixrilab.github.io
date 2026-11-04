import assert from "node:assert/strict";

import { matchedSignals, parseAlgoliaCredentials, parsePostedDate, parseUcRecruitRows, scanAlgoliaSource, stripHtml } from "../data-tools/discover-faculty-jobs.mjs";

assert.equal(stripHtml("<p>Human &amp; AI <strong>work</strong></p>"), "Human AI work");
assert.deepEqual(matchedSignals("Human-computer interaction and mixed reality systems"), ["HCI", "XR/VR/AR"]);
assert.deepEqual(matchedSignals("Human-AI collaboration and trust in AI for organizations"), [
  "human-AI interaction",
  "technology-rich human collaboration",
]);
assert.deepEqual(matchedSignals("Protein-protein interaction in molecular biosciences"), []);
assert.equal(parsePostedDate("Sep 15, 2026"), "2026-09-15");
assert.equal(parsePostedDate("Open Sep 8, 2026 – Nov 2, 2026"), "2026-09-08");
assert.equal(parsePostedDate("Dates not stated"), null);

const ucRows = parseUcRecruitRows(`
  <tbody data-section="School of Information">
    <tr id="JPF12345" class="linked match">
      <td class="name"><div class='name'>Assistant Professor in Human-Computer Interaction</div></td>
      <td class="submission-dates">Open Sep 1, 2026 through Dec 1, 2026</td></tr>
  </tbody>`, { id: "uc-test", institution: "Example UC", url: "https://recruit.example.edu/apply" });
assert.deepEqual(ucRows, [{
  sourceId: "uc-test",
  sourceJobId: "JPF12345",
  institution: "Example UC",
  title: "Assistant Professor in Human-Computer Interaction",
  unit: "School of Information",
  officialUrl: "https://recruit.example.edu/JPF12345",
  deadlineLabel: "Open Sep 1, 2026 through Dec 1, 2026",
  postedDate: "2026-09-01",
}]);

const source = { id: "ut-test", institution: "Example", url: "https://example.edu/career", applicationId: "TESTAPP", indexName: "POSITIONS" };
const inline = 'indexName:"POSITIONS",searchClient:client()("TESTAPP","test-search-key")';
const hoisted = 'const fv=(0,module.client)("TESTAPP","test-search-key");' + " ".repeat(1_500) + 'indexName:"POSITIONS",searchClient:fv';
for (const script of [inline, hoisted]) {
  assert.deepEqual(parseAlgoliaCredentials(script, source), { applicationId: "TESTAPP", apiKey: "test-search-key" });
}
assert.throws(() => parseAlgoliaCredentials(inline, { ...source, applicationId: "OTHERAPP" }), /configuration missing/);
assert.throws(() => parseAlgoliaCredentials(inline, { ...source, indexName: "OTHERINDEX" }), /index configuration/);
assert.throws(() => parseAlgoliaCredentials(inline + ';other("TESTAPP","another-key")', source), /ambiguous/);
const scanned = await scanAlgoliaSource(source, async (url, options) => {
  if (url === source.url) return '<script src="/main.123.js"></script>';
  if (url.endsWith("/main.123.js")) return hoisted;
  assert.equal(options.headers["X-Algolia-Application-Id"], "TESTAPP");
  assert.equal(options.headers["X-Algolia-API-Key"], "test-search-key");
  return JSON.stringify({ hits: [{ objectID: "42", name: "Assistant Professor in HCI", description: "Human-computer interaction", open_date_display: "Sep 1, 2026" }] });
});
assert.equal(scanned[0].officialUrl, "https://example.edu/career/42");
assert.equal(scanned[0].eligibleAppointment, true);

console.log(JSON.stringify({ status: "valid", suite: "faculty discovery" }, null, 2));
