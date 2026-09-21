import assert from "node:assert/strict";

import { buildCoverage, parseCarnegieInstitutions } from "../data-tools/audit-r1-portals.mjs";

const sampleHtml = `
  <tr>
    <td class="institution-title">
      <a href="https://carnegieclassifications.acenet.edu/institution/texas-am-university-college-station/">Texas A&#038;M University-College Station</a>
    </td>
    <td class="institution-location">
      <span class="institution-city">College Station</span>,
      <span class="institution-state">TX</span>
    </td>
  </tr>`;

const parsed = parseCarnegieInstitutions(sampleHtml);
assert.deepEqual(parsed, [{
  slug: "texas-am-university-college-station",
  name: "Texas A&M University-College Station",
  city: "College Station",
  state: "TX",
  carnegieUrl: "https://carnegieclassifications.acenet.edu/institution/texas-am-university-college-station/",
}]);

const output = buildCoverage({
  institutions: [
    parsed[0],
    {
      slug: "the-university-of-texas-at-austin",
      name: "The University of Texas at Austin",
      city: "Austin",
      state: "TX",
      carnegieUrl: "https://carnegieclassifications.acenet.edu/institution/the-university-of-texas-at-austin/",
    },
    {
      slug: "rice-university",
      name: "Rice University",
      city: "Houston",
      state: "TX",
      carnegieUrl: "https://carnegieclassifications.acenet.edu/institution/rice-university/",
    },
  ],
  jobs: [
    { id: "a", country: "United States", university: "Texas A&M University", title: "Assistant Professor", officialUrl: "https://example.edu/a", status: "Open" },
    { id: "b", country: "United States", university: "Rice University", title: "Assistant Professor", officialUrl: "https://example.edu/b", status: "Open" },
  ],
  sources: [{
    id: "ut",
    institution: "The University of Texas at Austin",
    carnegieSlug: "the-university-of-texas-at-austin",
    type: "algolia-angular",
    url: "https://faculty.utexas.edu/career",
  }],
  discoveryAudit: {
    sourcesChecked: [{ id: "ut", status: "Verified", checkedAt: "2026-09-21", postingsInspected: 133, candidatesFound: 3 }],
  },
  searchScope: {
    core: ["the-university-of-texas-at-austin"],
    directFitOnly: ["texas-am-university-college-station"],
    reasons: {
      Core: "core reason",
      "Direct-fit only": "direct reason",
      Excluded: "excluded reason",
    },
  },
  now: new Date("2026-09-21T01:00:00Z"),
  sourceSync: { status: "Verified", detail: "test" },
});

assert.deepEqual(output.summary, {
  registered: 3,
  core: 1,
  directFitOnly: 1,
  excluded: 1,
  fullPortalScan: 1,
  trackedPostingsOnly: 2,
  noPortalAdapter: 0,
  operationalAdapters: 1,
  failedAdapters: 0,
});
assert.equal(output.institutions.find((item) => item.slug === "texas-am-university-college-station").trackedJobs.length, 1);
assert.equal(output.institutions.find((item) => item.slug === "the-university-of-texas-at-austin").postingsInspected, 133);
assert.equal(output.institutions.find((item) => item.slug === "rice-university").searchScope, "Excluded");

console.log(JSON.stringify({ status: "valid", tests: 5 }, null, 2));
