# ZTC Pathway Mapper v3.5.7

Program-centric, term-aware Zero Textbook Cost (ZTC) analytics for active degree, certificate, and transfer pathways. Client-side single-file React app — no build step.

## Quick start

**End users (recommended):** open the hosted app — **[chairmanx.tech/projects/ztc-mapper](https://www.chairmanx.tech/projects/ztc-mapper/)** (Chaffey College · GitHub Pages). No install; includes all `vendor/` assets.

**Maintainers / offline:** open `index.html` from the **full project folder** (must include `vendor/`). Sharing `index.html` alone will not run.

1. Open the app (hosted URL above, or local folder).
2. Upload **Program Summary** CSV and **Course Analytics** CSV (click or drag-and-drop onto each card).
3. Click **Build dashboard**.

## Architecture (v3)

| Layer | Details |
|-------|---------|
| **Stack** | React **18.2.0**, Babel **7.23.5**, Chart.js **4.4.0**, jsPDF + AutoTable, Tailwind **3.4.17** — **vendored** under `vendor/`; zero external runtime deps |
| **Data** | Two datasources joined on `SUBJECT-NUMBER`; Active programs only |
| **Views** | Pathway (nested areas) and Courses (browse all courses) as primary reading views; Dashboard is a non-modal panel in the left navigation column |
| **Persistence** | Validated dataset at `ztc-pathway-mapper-v3`; debounced navigation state at `ztc-pathway-mapper-v3-ui`; recoverable invalid-cache handling and reset |
| **Exports** | Current pathway CSV/PDF with GE fidelity note; all-pathways summary CSV; spreadsheet-formula neutralization |

### Datasources

1. **Program Summary** — pathway structure (blocks, courses, units, choice vs all-required). Optional: `Header Identifier (*)`, `Group Title`, `Condition` for lab-reference re-lists and Either/Or/And option bundles.
2. **IE ZTC Course Analytics** — per-course, per-term ZTC %, survey completion, section counts.

Column headers are auto-detected via flexible name matching (`findIdx`). Full contract: vault `2-projects/ztc-pathway-mapper/ZTC-Pathway-Mapper-v3-CSV-Column-Contract.md`.

### Landing upload (v3.4)

- Each datasource card accepts **click-to-upload** or **drag-and-drop** (`.csv` only).
- Drop success is announced via `aria-live="polite"`; invalid files surface `role="alert"` errors.
- Shared `loadPendingCsv` pipeline for click and drop paths.

### Vendor dependencies

Runtime assets are vendored locally (`vendor/`) with pinned versions in `vendor/deps.json`. Verify integrity:

```bash
python3 scripts/check-deps.py
```

Re-fetch from upstream (after manifest edit):

```bash
./scripts/fetch-vendor.sh
```

Regenerate Tailwind CSS (maintainer only):

```bash
./scripts/generate-tailwind-css.sh
```

CI guardrail: `.github/workflows/ztc-mapper-guardrails.yml` runs dependency integrity, requirement scoring, FID-1, validated restore/persistence, export, Dashboard source/browser, Python lint, and axe WCAG regressions on `ztc-mapper/**` changes.

For a local real-data comparison against the checked-in baseline, write the report only under the ignored Rust `target/` tree:

```bash
node scripts/compare-fid1.js \
  --program-summary "/path/to/Program Summary.csv" \
  --analytics "/path/to/Course Analytics.csv" \
  --term 2026/FA \
  --output ../ztc-mapper-rs/target/ztc-audit/fid1-comparison.json
```

**Note:** Runtime SRI `integrity=` attributes are intentionally omitted — they break `file://` opens (same as `crossorigin`). File tampering is caught by `check-deps` sha384 vs `deps.json`.

### ZTC thresholds

- **Chaffey ZTC (green):** ≥75% of sections zero textbook cost
- **Partial:** 51–74%
- **CO ZTC (purple):** ≥1 ZTC section (Chancellor's Office definition)

Program adoption is **requirement-slot based**. A Choose-N block contributes N denominator slots; named subgroups retain their own quotas (for example, one Arts plus one Humanities); and every member of an AND bundle must meet the 75% bar. Required Core blocks continue to count every listed required course. Catalog requirements unavailable or unknown in the selected term remain in the denominator as unmet.

Required-unit minima use the same slot and subgroup constraints instead of selecting globally low-unit courses. Lab-reference re-lists remain outside adoption scoring. When the Program Summary lacks Header Identifier / Group Title / Condition evidence, the app reports the structural unit lower bound with `≥` and labels lab evidence **unverifiable**; it does not infer lab compliance.

### Course catalog link (v3.4)

- **Courses tab:** Chaffey catalog link shown only when the selected term is one of the **two most recent terms** in the analytics dataset (`getRecentTerms`).
- Older terms show a muted availability note instead of the link.
- **Pathway tab** course modal: catalog link always shown (unchanged).

### Dashboard pullout and responsive hierarchy (v3.5.7)

Dashboard is not a full-page destination or top-bar action. **Pathway** and **Courses** remain the only primary reading views. A graphite pullout with a blue edge indicator and directional chevron opens the Dashboard in the left navigation column. At 640px and above, the selected reading pane remains visible beside the bounded panel. Below 640px, Dashboard becomes the primary canvas while the selected pathway/course stays mounted, preserved, and temporarily `inert`/`aria-hidden`. Escape closes the panel and restores focus to the tab; the panel remains non-modal (no focus trap or backdrop).

The compact Dashboard features average ZTC adoption as its headline, highlights pathways needing attention, retains filtered KPI drill-downs in a two-column grid, and replaces the sidebar chart with an accessible sparkline and term-over-term delta. “View trend details” opens the full chart in a labelled modal without losing the prior selection. Distribution and a five-item ranking use progressive disclosure; “View all pathways” returns to the existing adoption-sorted Pathway view.

### Dashboard institution KPI actions

The headline and four compact KPI actions open **Pathway** or **Courses** with filters applied:

| Tile | Opens | Filter |
|------|-------|--------|
| Average ZTC adoption headline | Pathway | All pathways |
| Fully ZTC-able | Pathway | 100% adoption |
| ≥75% ZTC-able | Pathway | ≥75% adoption |
| Chaffey ZTC courses | Courses | ZTC status (≥75% sections) |
| Chancellor's Office ZTC courses | Courses | CO ZTC (≥1 section) |

### Accessibility

WCAG 2.1 Level AA. Re-verify after UI changes:

```bash
python3 -m http.server 8767   # temporary — kill when done
python3 scripts/run-axe-v3.py http://localhost:8767/index.html
```

Dashboard-panel regressions (no production CSVs required):

```bash
node scripts/test-dashboard-panel.js
python3 scripts/test-dashboard-panel-ui.py
```

The axe harness covers **11 UI states**, including an explicit lab-reference pathway, using checked-in de-identified fixtures. Latest completed baseline: 2026-10-08 v3.5.7 run, 0 violations across all 11 states; re-run the harness after UI changes. Source, semantic-tree, keyboard, focus, and responsive geometry checks are recorded in `ACCESSIBILITY_VERIFICATION.md`.

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
