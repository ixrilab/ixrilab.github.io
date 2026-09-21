import assert from "node:assert/strict";

import { matchedSignals, stripHtml } from "../data-tools/discover-faculty-jobs.mjs";

assert.equal(stripHtml("<p>Human &amp; AI <strong>work</strong></p>"), "Human AI work");
assert.deepEqual(matchedSignals("Human-computer interaction and mixed reality systems"), ["HCI", "XR/VR/AR"]);
assert.deepEqual(matchedSignals("Human-AI collaboration and trust in AI for organizations"), [
  "human-AI interaction",
  "technology-rich human collaboration",
]);
assert.deepEqual(matchedSignals("Protein-protein interaction in molecular biosciences"), []);

console.log(JSON.stringify({ status: "valid", tests: 4 }, null, 2));
