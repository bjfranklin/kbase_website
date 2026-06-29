# ZTC Pathway Mapper v3.4

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
| **Views** | Dashboard (institution-wide), Pathway (nested areas), Courses (browse all courses) |
| **Persistence** | `localStorage` key `ztc-pathway-mapper-v3` (migrates from `-v2` on load) |
| **Exports** | Current pathway CSV/PDF; all-pathways summary CSV |

### Datasources

1. **Program Summary** — pathway structure (blocks, courses, units, choice vs all-required).
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

CI guardrail: `.github/workflows/ztc-mapper-guardrails.yml` runs `check-deps.py` on `ztc-mapper/**` changes.

**Note:** Runtime SRI `integrity=` attributes are intentionally omitted — they break `file://` opens (same as `crossorigin`). File tampering is caught by `check-deps` sha384 vs `deps.json`.

### ZTC thresholds

- **Chaffey ZTC (green):** ≥75% of sections zero textbook cost
- **Partial:** 51–74%
- **CO ZTC (purple):** ≥1 ZTC section (Chancellor's Office definition)

Program adoption is **requirement-based**: choice blocks count as ZTC if ≥1 valid option meets the 75% bar.

### Course catalog link (v3.4)

- **Courses tab:** Chaffey catalog link shown only when the selected term is one of the **two most recent terms** in the analytics dataset (`getRecentTerms`).
- Older terms show a muted availability note instead of the link.
- **Pathway tab** course modal: catalog link always shown (unchanged).

### Dashboard institution KPIs (v3.1)

Six clickable tiles under **Institution overview** — each opens **Pathway** or **Courses** with filters applied:

| Tile | Opens | Filter |
|------|-------|--------|
| Active pathways | Pathway | All pathways |
| Avg ZTC adoption | Pathway | Scored pathways only |
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

**Latest:** axe-core 4.10.2 — **0 violations** across **10 UI states** (2026-06-29). See `ACCESSIBILITY_VERIFICATION.md`.

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
| **v3.4** | Drag-and-drop CSV landing; catalog link gated to two most recent terms (Courses tab); catalog availability note; axe harness 10 states |
| **v3.3** | Tailwind 3.4.17 offline CSS; zero external runtime deps |
| **v3.2** | Vendored JS (React 18.2.0 exact pin); `check-deps.py` + `deps.json`; CSV column contract in vault |
| **v3.1** | Dashboard KPI tiles (Chaffey/CO course counts); clickable drill-down; JAWS heading/chart fixes; CO ZTC course filter; app footer; filter/sidebar cleanup |
| **v3.0** | Two-datasource rebuild; institution dashboard; CO ZTC badge; Babel 7 pin |
| **v2.3** | Single CSV, column mapping, multi-project, CSV/Excel/PDF/PNG (`index.v2.3.html`) |
