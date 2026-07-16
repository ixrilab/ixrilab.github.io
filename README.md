# CS Faculty Job Tracker

This repository publishes an independent, static GitHub Pages application at the site root.

## Data flow

1. The daily career-radar automation verifies original job postings.
2. Active and eligible roles are exported, then `data-tools/normalize-jobs-to-english.mjs` converts the public dataset to English.
3. `tests/validate-data.mjs` checks required fields, URLs, active status, ordering, privacy markers, and English-only output.
4. Only validated data is committed and pushed.
5. GitHub Pages publishes the updated JSON without a separate frontend build.

## Privacy

The tracker must not contain personal names, personal email addresses, local filesystem paths, credentials, or private application notes. Commit identity is configured locally as `CS Faculty Job Tracker Bot`.

## Validate locally

```powershell
node .\tests\validate-data.mjs
```
