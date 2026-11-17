# ZTC Pathway Mapper v4.1.0

> **v4.0 (2026-11-12): pathway structure now comes from the official catalog.** The Program Summary (CurriQunet custom report) upload is retired. The app needs one upload, the ZTC course dataset from Informer; pathway requirements are read from `data/catalog-<year>.js`, which is generated from the catalog's Degrees and Certificates export. The last two-CSV release is archived as `index.v3.5.7.html`. Sections below that describe the Program Summary upload, Group Title markers, or `Condition` rules document that archived version; the legacy builder code is still in `index.html` but no longer reachable from the UI and is scheduled for removal.

## How v4 gets pathway structure

1. `catalog/Chaffey_Catalog_2026-2027_Degrees_and_Certificates.md` is the catalog export (public information).
2. `scripts/build-catalog-structure.py` parses it into requirement slots ("need N of these options", where an option is one course or a bundle of courses taken together) and writes `data/catalog-<year>.js` plus `data/catalog-<year>-reconciliation.json`.
3. Every requirement block is **reconciled against the units the catalog prints for it**. Blocks that do not add up are kept but marked unverified, and the app shows an "Unverified structure" note on those pathways. Current build (2026–27): 201 pathways, 359 of 360 blocks verified, 1 pathway with an unverified block (see `catalog/OPEN-QUESTIONS.md`). No block is dropped from a pathway: one that cannot be read is listed with its courses and marked "listed but not scored".
4. Catalog instruction rows are kept and shown under their block. An Either/Or entry is two options (the course alone, or the course with its lab). A laboratory section that re-lists courses (Cal-GETC "C - Laboratory Science") is its own requirement, met by any option above that includes a lab (*). A general-education placeholder row ("Area 5B: Biological Sciences") is one requirement, met by any ZTC course in the matching Cal-GETC area.

**Academic years.** The Pathway view and the Dashboard are filtered by academic year (Fall → Spring → Summer, so 2026–27 is 2026/FA, 2027/SP, 2027/SU); the Courses view keeps the Term filter. Each year is scored against its own catalog: `catalog/Chaffey_Catalog_<year>_Degrees_and_Certificates.md` → `data/catalog-<year>.js` (2023–24 through 2026–27 are built in). For a year, a course is ZTC only if it meets 75%+ of sections in **every term it was offered**; the row shows the lowest term and names the terms below 75%. The year's survey completion is shown beside the score, and a year is labelled "In progress" while any of its three terms is missing from the dataset or below 90% survey completion. To add a year: put its catalog export in `catalog/`, run the builder with `--catalog-year`, add the `<script>` tag in `index.html`, and add its entry to `vendor/deps.json`.

**Rust twin.** `../ztc-mapper-rs/` is kept at value-for-value parity. `scripts/dump-pathway-scores.js` writes every pathway score for every catalog year; CI fails if `../ztc-mapper-rs/fixtures/parity/production-scores.sample.json` is stale, so regenerate it (command in the twin README) and update the twin whenever scoring changes.

**Rules the reader applies beyond the plain lists.**
- Courses under "Strongly recommended:", "Recommended (Optional):", "Optional Course:" or "This course is recommended, but not required:" are listed and never counted.
- "Choose one group:" followed by "Group 1 / Group 2" is one requirement; each group is an alternative (courses joined by AND are taken together).
- "Any three courses (maximum of one from each category)" needs three of the categories, one course from each.
- "... or any course not taken from List A" also counts the options List A leaves over once List A itself is met. A left-over course is claimed once: when List B and List C both borrow from List A, List B takes what it needs first.
- "Any three courses from at least two of the following areas" and "from at least two different disciplines": courses from a single area (or subject) fill all but the places that must come from another.
- A correction the reader makes to the catalog text (for example "ASTRON 27 OR ASTRON 27L", read as lecture with its lab) is shown on screen under that section as "Note from the app".
- A noncredit certificate that prints hours only for the pathway is verified against the pathway total.
- Several "Choose one group:" captions inside one section (older Automotive Technology certificates) are one requirement each; the group numbering restarts with each caption.
- "N units from the following" needs the fewest courses that reach N units. Whole courses rarely add up to exactly N, so the section is verified when the catalog prints the range of totals a student can actually end with (Accounting: nine units from 3, 3, 4, 4 and 1.5-unit courses prints 9.5–11).
- In a general-education pattern, an area with a plain list and no count is one course (IGETC Area 7).
- "Required CSU only" (IGETC Area 1 Group C) is counted as a requirement and noted on screen; the printed unit range starts without it.
- "Language Other Than English" as a general-education row can be met in high school: it is listed and not scored.

**Reviewed sections.** A sign-off also covers another year's catalog when that year prints the same section of the same pathway word for word (same `sectionSha256`). The unit check is strict: a section is verified only when the units read match the units printed. When a person has checked a section that does not match, record it in `catalog/reviewed-sections.json` (pathway, section, who, when, why, and the `sectionSha256` from `data/catalog-<year>-reconciliation.json`). It then shows as "verified by review". The sign-off is tied to that section's catalog text: if the text changes in a later export, the build stops until the section is reviewed again.

**Colour rule.** A course is ZTC at 75%+ of sections (unchanged). A pathway or section is green only at 100% of requirements, yellow at 75–99%, red below 75%. Chancellor's Office ZTC (at least one section) is shown for reporting only and never counts toward a pathway.
4. `vendor/deps.json` pins the generated file's sha384 (`check-deps.py`), and CI rebuilds it from the catalog export and requires a byte-for-byte match.

Refreshing for a new catalog year or addendum:

```bash
python3 scripts/build-catalog-structure.py catalog/<export>.md --catalog-year 2027-2028
# review data/catalog-<year>-reconciliation.json, then update the sha384 in vendor/deps.json
node scripts/test-catalog-structure.js
```

Scoring rules in v4: a required course is one requirement; "Choose one" (and Group N alternatives) is one requirement met by any one option; "Any N courses" is N requirements from the list; "N units from the following" needs the fewest courses that reach N units; a bundle (courses joined by AND) is met only when every course in it meets the 75% bar. Units shown are the catalog's printed units. Saved sessions store only the ZTC data and are rebuilt against the catalog file on load (dataset schema 3).

Program-centric, term-aware Zero Textbook Cost (ZTC) analytics for active degree, certificate, and transfer pathways. Client-side single-file React app — no build step.

## Quick start

**End users (recommended):** open the hosted app — **[chairmanx.tech/projects/ztc-mapper](https://www.chairmanx.tech/projects/ztc-mapper/)** (Chaffey College · GitHub Pages). No install.

**Maintainers / offline:** open `index.html` from the **full project folder** (it needs `vendor/` and `data/`). Sharing `index.html` alone will not run.

1. Open the app.
2. Upload the **ZTC course dataset** CSV from Informer (click or drag-and-drop).
3. Click **Build dashboard**.

## Architecture (v4)

| Layer | Details |
|-------|---------|
| **Stack** | React **18.2.0**, Babel **7.23.5**, Chart.js **4.4.0**, jsPDF + AutoTable, Tailwind **3.4.17** — **vendored** under `vendor/`; zero external runtime deps |
| **Data** | Pathway structure from the built-in catalogs (`data/catalog-<year>.js`); one upload, the ZTC course dataset, joined on `SUBJECT-NUMBER` |
| **Views** | Pathway (by academic year) and Courses (by term) as primary reading views; Dashboard is a non-modal panel in the left navigation column |
| **Persistence** | The uploaded dataset at `ztc-pathway-mapper-v3` (pathways are always rebuilt from the catalog, never restored); navigation state at `ztc-pathway-mapper-v3-ui`; recoverable invalid-cache handling and reset |
| **Exports** | Current pathway CSV/PDF; all-pathways summary CSV; spreadsheet-formula neutralization |

The code that read the retired Program Summary export was removed in v4.1.0; `index.v3.5.7.html` is the last version that has it.

### Vendor dependencies

Runtime assets are vendored locally (`vendor/`) with pinned versions in `vendor/deps.json`, which also pins the generated catalog files. Verify integrity:

```bash
python3 scripts/check-deps.py
```

Re-fetch from upstream (after manifest edit): `./scripts/fetch-vendor.sh`. Regenerate Tailwind CSS (maintainer only): `./scripts/generate-tailwind-css.sh`. Only classes present in `vendor/tailwind.min.css` work; use inline styles for anything else.

**Note:** Runtime SRI `integrity=` attributes are intentionally omitted — they break `file://` opens (same as `crossorigin`). File tampering is caught by `check-deps` sha384 vs `deps.json`.

### Tests

```bash
node scripts/test-catalog-structure.js     # reader rules and catalog-verified pathways
node scripts/test-independent-count.js     # second reader, see below
node scripts/test-academic-year.js         # year rule across all four catalogs
node scripts/test-session-restore.js
node scripts/test-exports.js
node scripts/test-csv-and-defaults.js
node scripts/test-dashboard-panel.js
python3 scripts/test-dashboard-panel-ui.py # browser test, needs Playwright
```

`.github/workflows/ztc-mapper-guardrails.yml` runs all of these, the dependency check, the Rust parity fixture check, a byte-for-byte rebuild of every catalog, Python lint and the axe run.

**Independent count.** The unit check catches a section whose units do not add up. It cannot catch a rule that was misread but still adds up. `test-independent-count.js` is a second, deliberately simple reader: it counts requirements straight from the catalog Markdown for every pathway made only of plain lists, "any N courses" lists and simple "Choose one" entries, and requires the app to score the same number. It covers a little over half of the pathways in each year (116 of 201 in 2026–27) and skips the rest instead of guessing.

### ZTC thresholds

- **Chaffey ZTC (green):** 75%+ of sections zero textbook cost
- **Partial:** 51–74%
- **CO ZTC (purple):** at least one ZTC section (Chancellor's Office definition; reporting only)

For an academic year a course must be at 75%+ in **every term it was offered**; the app names the terms that missed. A year is labelled "In progress" while survey completion is under 90% or a term is not in the dataset yet.

### Course catalog link

- **Courses tab:** the Chaffey catalog link is shown only when the selected term is one of the two most recent terms in the dataset.
- **Pathway tab** course modal: the catalog link is always shown.

### Dashboard

**Pathway** and **Courses** are the only primary reading views. A pullout opens the Dashboard in the left navigation column; under 640px it takes the main canvas. The headline and four KPI actions open Pathway or Courses with filters applied:

| Tile | Opens | Filter |
|------|-------|--------|
| Average ZTC adoption headline | Pathway | All pathways |
| Fully ZTC-able | Pathway | 100% adoption |
| ≥75% ZTC-able | Pathway | ≥75% adoption |
| Chaffey ZTC courses | Courses | ZTC status (≥75% sections) |
| Chancellor's Office ZTC courses | Courses | CO ZTC (≥1 section) |

"Needs attention" lists pathways below 75%.

### Accessibility

WCAG 2.1 Level AA. Re-verify after UI changes:

```bash
python3 -m http.server 8767   # temporary — kill when done
python3 scripts/run-axe-v3.py http://localhost:8767/index.html
```

The axe harness covers **14 UI states** using the checked-in sample dataset. Latest run: 2026-11-15, 0 violations across all 14 states.

## Deferred (on stakeholder request)

- Excel export (SheetJS)
- PNG/screenshot export (html2canvas)
- Multi-project save/load (named snapshots)

See `index.v2.3.html` and docs marked *v2.3 historical* for the previous single-CSV app.

## Publishing (GitHub Pages)

**End-user URL:** [https://www.chairmanx.tech/projects/ztc-mapper/](https://www.chairmanx.tech/projects/ztc-mapper/)

Canonical source: **kbase_dev** → synced to **kbase_website** (`projects/ztc-mapper/`). Portfolio: [chairmanx.tech](https://www.chairmanx.tech/).

```bash
./scripts/sync-kbase-website-projects.sh
```

Or push `main` with `KBASE_WEBSITE_SYNC_TOKEN` set (see root `CLAUDE.md`).

## End-user guide

**[ZTC-Pathway-Mapper-End-User-Guide.html](ZTC-Pathway-Mapper-End-User-Guide.html)** — concise guide for committee, deans, and IR staff (source also in vault `2-projects/ztc-pathway-mapper/`).

## Vault docs

Extended product spec and tracker: `kbase_professional/2-projects/ztc-pathway-mapper/`.

## Version history

| Version | Notes |
|---------|-------|
| **v4.1.0** | Academic Year filter on Pathway/Dashboard with one catalog per year (2023–24 to 2026–27); strict year rule (75%+ in every term offered) with missed terms named; survey completion and "In progress" label; pathway colours green 100% / yellow 75–99% / red <75%; Cal-GETC lab requirement, Either/Or options, GE placeholder rows and catalog instructions |
| **v4.0.0** | Pathway structure from the official catalog export with unit reconciliation; single ZTC dataset upload; grouped choice display; unverified-structure note; faster CSV parser; current-term default; v3.5.7 archived as `index.v3.5.7.html` |
| **v3.5.7** | Sub-640px primary-canvas Dashboard; headline hierarchy; quieter pullout; sparkline/delta; stacked distribution; short ranking and modal trend detail; explicit requirement-slot scoring, subgroup-aware units, program-wide course deduplication, and strict count parsing |
| **v3.5.6** | Dashboard trigger moved from the top bar to an accessible vertical pullout tab on the left edge; bounded panel behavior remains unchanged |
| **v3.5.5** | Bounded-sidebar Dashboard panel: Pathway/Courses stay the reading views; Dashboard replaces only the `w-72 lg:w-80` navigation column |
| **v3.5.4** | FID-1 parity: collapse only consecutive duplicate Group Title markers; apply `Choose one:` to following courses without relabeling preceding required courses |
| **v3.5.3** | Correct term-specific requirement denominators: unavailable/unknown required courses remain unmet; AND bundles require every member to be offered and ZTC |
| **v3.5.2** | Courses membership placement subtitles (export area/block); jump announce + scroll-to-course; list semantics polish |
| **v3.5.1** | Pathway spacing/mobile/lab-ref polish; Dashboard overview drops Avg ZTC tile (5 KPIs one row); Courses “In pathways” membership tiles → Pathway jump |
| **v3.5** | Pathway fidelity: lab-reference (*) re-lists (display-only); Group Title / Condition choice bands when present in export; ZTC-first decision rows (not a CurriQunet replica); GE export-limitation note |
| **v3.4** | Drag-and-drop CSV landing; catalog link gated to two most recent terms (Courses tab); catalog availability note; axe harness 10 states |
| **v3.3** | Tailwind 3.4.17 offline CSS; zero external runtime deps |
| **v3.2** | Vendored JS (React 18.2.0 exact pin); `check-deps.py` + `deps.json`; CSV column contract in vault |
| **v3.1** | Dashboard KPI tiles (Chaffey/CO course counts); clickable drill-down; JAWS heading/chart fixes; CO ZTC course filter; app footer; filter/sidebar cleanup |
| **v3.0** | Two-datasource rebuild; institution dashboard; CO ZTC badge; Babel 7 pin |
| **v2.3** | Single CSV, column mapping, multi-project, CSV/Excel/PDF/PNG (`index.v2.3.html`) |
