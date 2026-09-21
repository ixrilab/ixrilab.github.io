# HCI · XR Career and Funding Radar

This repository publishes an independent, static GitHub Pages application at the site root.

## Data flow

1. `.github/workflows/refresh-tracker.yml` runs daily and can also be started manually. It verifies original posting URLs, removes opportunities with passed deadlines or definitive closure responses, and recalculates job countdowns.
2. Active and eligible roles are exported, then `data-tools/normalize-jobs-to-english.mjs` converts the public jobs dataset to English.
3. Funding opportunities are checked against `data-tools/funding-sources.json` and published to `data/funding.json` with explicit eligibility routes and confidence.
4. `tests/validate-data.mjs` checks both datasets, URLs, statuses, ordering, privacy markers, English-only output, and the Jobs/Funding tab wiring.
5. Only validated data is committed and pushed with the workflow's short-lived `GITHUB_TOKEN`.
6. GitHub Pages publishes the updated JSON without a separate frontend build.

The repository does not contain the external research process that originally discovered new opportunities. The built-in workflow keeps the published tracker accurate and current; newly discovered opportunities still need to be added to the JSON by a separate research process or a reviewed pull request.

## Automation requirements

- GitHub Actions must be enabled for the repository.
- The refresh workflow explicitly requests only `contents: write` for its short-lived `GITHUB_TOKEN`; the repository's default workflow permission can remain read-only. If an organisation policy blocks that explicit grant, allow contents write for this workflow. No long-lived personal access token or repository secret is required.
- GitHub Pages should publish the `main` branch from `/ (root)`. The custom domain is defined by `CNAME` as `ixrilab.com`.

## Privacy

The tracker must not contain personal names, personal email addresses, local filesystem paths, credentials, or private application notes. Automated commits use the non-personal `IXRI Lab Tracker Bot` identity.

## Validate locally

```powershell
node .\tests\refresh-tracker.mjs
node .\tests\validate-data.mjs
```

Run `node .\data-tools\refresh-tracker.mjs --dry-run` to inspect live-source results without changing the JSON files.
