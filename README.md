# HCI · XR Career and Funding Radar

This repository publishes an independent, static GitHub Pages application at the site root.

## Data flow

1. The daily career-radar automation verifies original job postings and official funding sources.
2. Active and eligible roles are exported, then `data-tools/normalize-jobs-to-english.mjs` converts the public jobs dataset to English.
3. Funding opportunities are checked against `data-tools/funding-sources.json` and published to `data/funding.json` with explicit eligibility routes and confidence.
4. `tests/validate-data.mjs` checks both datasets, URLs, statuses, ordering, privacy markers, English-only output, and the Jobs/Funding tab wiring.
5. Only validated data is committed and pushed.
6. GitHub Pages publishes the updated JSON without a separate frontend build.

## Privacy

The tracker must not contain personal names, personal email addresses, local filesystem paths, credentials, or private application notes. Commit identity is configured locally as `CS Faculty Job Tracker Bot`.

## Validate locally

```powershell
node .\tests\validate-data.mjs
```
