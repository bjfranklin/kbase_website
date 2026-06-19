# ZTC Pathway Mapper v3.0

Program-centric, term-aware Zero Textbook Cost (ZTC) analytics for active degree, certificate, and transfer pathways. Client-side single-file React app — no build step.

## Quick start

1. Open `index.html` in a browser (or serve this folder locally).
2. Upload **Program Summary** CSV and **Course Analytics** CSV.
3. Click **Build dashboard**.

## Architecture (v3)

| Layer | Details |
|-------|---------|
| **Stack** | React 18, Tailwind CDN, Babel Standalone **7.23.5** (pinned), Chart.js, jsPDF + AutoTable |
| **Data** | Two datasources joined on `SUBJECT-NUMBER`; Active programs only |
| **Views** | Dashboard (institution-wide), Pathway (nested areas), Courses (browse all courses) |
| **Persistence** | `localStorage` key `ztc-pathway-mapper-v3` (migrates from `-v2` on load) |
| **Exports** | Current pathway CSV/PDF; all-pathways summary CSV |

### Datasources

1. **Program Summary** — pathway structure (blocks, courses, units, choice vs all-required).
2. **IE ZTC Course Analytics** — per-course, per-term ZTC %, survey completion, section counts.

Column headers are auto-detected via flexible name matching (`findIdx`).

### ZTC thresholds

- **Chaffey ZTC (green):** ≥75% of sections zero textbook cost
- **Partial:** 51–74%
- **CO ZTC (purple):** ≥1 ZTC section (Chancellor's Office definition)

Program adoption is **requirement-based**: choice blocks count as ZTC if ≥1 valid option meets the 75% bar.

## Deferred to v3.1

- Excel export (SheetJS)
- PNG/screenshot export (html2canvas)
- Multi-project save/load (named snapshots)

See `index.v2.3.html` and docs marked *v2.3 historical* for the previous single-CSV app.

## Publishing (GitHub Pages)

Canonical source: **kbase_dev** → synced to **kbase_website** (`projects/ztc-mapper/`).

```bash
./scripts/sync-kbase-website-projects.sh
```

Or push `main` with `KBASE_WEBSITE_SYNC_TOKEN` set (see root `CLAUDE.md`).

## Vault docs

Extended product spec and tracker: `kbase_professional/2-projects/ztc-pathway-mapper/`.

## Version history

| Version | Notes |
|---------|-------|
| **v3.0** | Two-datasource rebuild; institution dashboard; CO ZTC badge; Babel 7 pin |
| **v2.3** | Single CSV, column mapping, multi-project, CSV/Excel/PDF/PNG (`index.v2.3.html`) |
