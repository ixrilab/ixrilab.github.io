import assert from "node:assert/strict";

import { matchedSignals, parsePostedDate, parseUcRecruitRows, stripHtml } from "../data-tools/discover-faculty-jobs.mjs";

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

console.log(JSON.stringify({ status: "valid", tests: 8 }, null, 2));
