# HCI · XR Faculty and Funding Radar

This repository publishes an independent, static GitHub Pages application at the site root.

## Data flow

1. `data-tools/faculty-search-policy.json` defines the geographic limits, eligible appointment types, direct/strong/broad research-fit gates, pure-robotics exclusions, evidence requirements, and score weights.
2. Faculty searches are researched against official university sources. Each public record includes exact appointment details, review and final dates, status, a profile-specific fit note, named collaboration faculty, target-venue evidence, and verification history.
3. `.github/workflows/refresh-tracker.yml` runs `data-tools/run-refresh.mjs` daily and can also be started manually. New-posting discovery and existing-record refresh run independently. A failed discovery source does not stop faculty or funding updates. Faculty and funding refreshes also save their results independently if one encounters an unexpected error. The updater checks tracked URLs, recalculates evidence scores and posting-age warnings, and changes expired or definitively closed faculty searches to `Closed` without deleting their history.
4. `data-tools/audit-r1-portals.mjs` synchronises the official 2025 Carnegie R1 registry and publishes `data/r1-coverage.json`. The separate `r1-search-scope.json` keeps all 187 institutions auditable while limiting active discovery to Core and explicitly direct-fit schools. Full scans, tracked postings, failures, and missing adapters remain distinct coverage states.
5. Existing funding opportunities in `data/funding.json` are checked for URL availability, closure notices, and saved deadlines. `data-tools/funding-sources.json` is a source registry for reviewed research; it is not an automatic new-call collector. An available webpage does not independently establish that eligibility or deadlines are unchanged.
6. `tests/validate-data.mjs` enforces the faculty-only scope, country/institution rules, all 187 Carnegie R1 records, coverage-state integrity, evidence links, score ordering, history retention, privacy markers, English-only output, and the Faculty/Funding/Coverage tab wiring.
7. Only validated data is committed and pushed with the workflow's short-lived `GITHUB_TOKEN`. `data/refresh-status.json` records each stage's outcome, including failed sources and links that could not be rechecked. Blocked individual links produce warnings. A failed stage makes CI fail after valid updates and the status report are saved. The website shows warnings for incomplete checks and datasets older than two days.
8. After committing validated results, the workflow explicitly requests a GitHub Pages rebuild. A push made with `GITHUB_TOKEN` does not trigger a Pages build by itself. No frontend compilation is required.

The scheduled workflow can discover candidates from the official portals listed in `data-tools/faculty-discovery-sources.json`; `data/faculty-discovery.json` records what was inspected and flags unreviewed candidates. It does not silently publish candidates because appointment type, research fit, collaborator evidence, and current application status still require a reviewed research pass. Institutions without a supported official-portal adapter must be audited separately rather than assumed covered.

For a reviewed research pass, prepare a JSON payload with a `jobs` array and preview the comparison with:

```powershell
node .\data-tools\merge-faculty-jobs.mjs --incoming .\reviewed-jobs.json
```

Add `--write` after reviewing the preview. The merge preserves missing historical rows and automatically records `Newly Posted`, `Deadline/Review Date Changed`, `Status Changed`, or `Closed` events in each job's change log.

## Faculty score

The score is out of 100, evidence-based, and deliberately fit-first:

- Direct / Strong / Broad fit: 70 / 40 / 15 points.
- Verified collaboration faculty: up to 12 points, with extra evidence weight for ISMAR, IEEE VR, or TVCG publications and a smaller CHI/UIST bonus.
- Relevant institutional research environment: 8 / 5 / 3 points for Exceptional / Very Strong / Strong evidence.
- Eligible rank: 4 points for Assistant Professor, 3 for Assistant/Associate, and 2 for open rank accepting Assistant applicants.
- Posting clarity: up to 6 points—2 for a verified posted date under six months old, 2 for a current review date, and 2 for a current final deadline.

Unknown or old posted dates, missing or passed review dates, and missing final deadlines receive zero for that component. The ranges ensure that even the strongest possible `Strong` position cannot outrank a qualifying `Direct` position solely because of prestige or date completeness.

An official posted date at least six calendar months old produces an `Older than 6 months — reconfirm` warning. Missing posted dates remain `Date unavailable`; the tracker never invents a date from when a role was discovered.

## Automation requirements

- GitHub Actions must be enabled for the repository.
- The refresh workflow explicitly requests `contents: write` to save results and `pages: write` to request a Pages rebuild with its short-lived `GITHUB_TOKEN`. The repository's default workflow permission can remain read-only. If an organisation policy blocks these explicit grants, allow them for this workflow. No long-lived personal access token or repository secret is required.
- GitHub Pages should publish the `main` branch from `/ (root)`. The custom domain is defined by `CNAME` as `ixrilab.com`.

## Privacy

The tracker must not contain personal names, personal email addresses, local filesystem paths, credentials, or private application notes. Automated commits use the non-personal `IXRI Lab Tracker Bot` identity.

## Validate locally

```powershell
node .\tests\refresh-tracker.mjs
node .\tests\validate-data.mjs
```

Run `node .\data-tools\refresh-tracker.mjs --dry-run` to inspect live-source results without changing the JSON files.

Run `node data-tools/run-refresh.mjs` for the full refresh, or add `--dry-run` to avoid writing datasets. Exit code 1 means a stage failed; source verification warnings are printed without stopping the workflow. Run `node tests/run-refresh.mjs` to verify failure isolation.

`xrmemory/` serves the separate Korean XRMemory review guide, scope checklist, and workflow instructions. Personal reviewer records and passwords, including encrypted copies, are excluded from this repository. The reviewer enters an account and password directly at /xrmemory/. The app fetches only the authenticated account’s encrypted record set from the access server. The existing private backup portal is separate. The published example paper is used for the local trial.
