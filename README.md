# HCI · XR Faculty and Funding Radar

This repository publishes an independent, static GitHub Pages application at the site root.

## Data flow

1. `data-tools/faculty-search-policy.json` defines the geographic limits, eligible appointment types, direct/strong/broad research-fit gates, pure-robotics exclusions, evidence requirements, and score weights.
2. Faculty searches are researched against official university sources. Each public record includes exact appointment details, review and final dates, status, a profile-specific fit note, named collaboration faculty, target-venue evidence, and verification history.
3. `.github/workflows/refresh-tracker.yml` runs daily and can also be started manually. It first scans supported official faculty-career indexes for newly posted candidates, then verifies every tracked URL, recalculates evidence scores and posting-age warnings, and changes expired or definitively closed faculty searches to `Closed` without deleting their history.
4. Funding opportunities are checked against `data-tools/funding-sources.json` and published to `data/funding.json` with explicit eligibility routes and confidence.
5. `tests/validate-data.mjs` enforces the faculty-only scope, country/institution rules, R1 flag for US positions, evidence links, score ordering, history retention, privacy markers, English-only output, and the Faculty/Funding tab wiring.
6. Only validated data is committed and pushed with the workflow's short-lived `GITHUB_TOKEN`.
7. GitHub Pages publishes the updated JSON without a separate frontend build.

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
