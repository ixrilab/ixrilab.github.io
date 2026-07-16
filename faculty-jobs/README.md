# CS Faculty Job Tracker

This directory is an independent, static GitHub Pages application served at `/faculty-jobs/`.

## Data flow

1. The daily career-radar automation verifies original job postings.
2. Active and eligible roles are exported to `data/jobs.json`.
3. `tests/validate-data.mjs` checks required fields, URLs, active status, ordering, and privacy markers.
4. Only validated data is committed and pushed.
5. GitHub Pages publishes the updated JSON without a separate frontend build.

## Privacy

The tracker must not contain personal names, personal email addresses, local filesystem paths, credentials, or private application notes. Commit identity is configured locally as `CS Faculty Job Tracker Bot`.

## Validate locally

```powershell
node .\faculty-jobs\tests\validate-data.mjs
```
