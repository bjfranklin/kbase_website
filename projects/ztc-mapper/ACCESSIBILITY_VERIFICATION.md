# Accessibility Verification — v3.5.7

> Historical v2.3 line-level audit: see vault `2-projects/ztc-pathway-mapper/ZTC-Pathway-Mapper-ACCESSIBILITY_VERIFICATION.md`.

## Dashboard responsive hierarchy (v3.5.7)

Dashboard is a non-modal sidebar panel opened by an icon-first far-left pullout with a visible hover/focus label, `aria-expanded`, `aria-controls`, directional chevron, and text-independent blue edge indicator. Escape closes and restores focus. Inactive sliding content is `inert` and `visibility: hidden`; there is no focus trap. `prefers-reduced-motion` remains honored.

At 640px and above, Dashboard remains bounded to the `w-72 lg:w-80` navigation column and the reading pane stays visible. Below 640px, Dashboard fills the canvas beside the 44px rail; the Pathway/Courses pane remains mounted with its selection preserved but becomes width zero, `visibility: hidden`, `aria-hidden`, and `inert` until the panel closes.

The v3.5.7 visual hierarchy retains text labels for every status, gives close/action controls a minimum 44px target, provides accessible text for the sparkline and stacked distribution, and moves the full trend chart into a labelled reading-pane detail with a Back action.

Verify geometry/keyboard/selection without production CSVs:

```bash
python3 scripts/test-dashboard-panel-ui.py
```

Verification on 2026-09-14:

- React source, requirement-scoring, and FID-1 regressions passed.
- Cursor browser semantic-tree and geometry checks passed at 390px, 640px, and desktop widths in dark and light themes.
- At 390px, the Dashboard canvas measured 346px beside the 44px rail; the mounted reading pane measured 0px and exposed `aria-hidden` + `inert`. At 640px, the reading pane remained visible, uninert, and 308px wide.
- Headline KPI, Needs attention, disclosure, stacked distribution, trend-detail/Back flow, selection persistence, and accessible names were present in the browser accessibility tree.
- The standalone Playwright wrapper could not launch its bundled headless Chromium inside the shell sandbox; the equivalent checks above were completed through Cursor’s browser. The last full axe run remains the v3.5.5 result below.

## axe-core (2026-09-01) — v3.5.5 Dashboard panel

Run: `python3 scripts/run-axe-v3.py http://127.0.0.1:8767/ztc-mapper/index.html`

**Result:** **0 WCAG 2.1 AA violations** across **10 UI states**, including Dashboard panel open (dark + light) with Pathway/Courses remaining the reading views.

## axe-core (2026-08-04) — v3.5.2 Plan 3 polish

Run: `ZTC_PROG_CSV=…/Program Summary 2026-08-03_113716.csv python3 scripts/run-axe-v3.py http://localhost:8767/index.html`

**Result:** **0 WCAG 2.1 AA violations** across **10 UI states**, including Courses membership `ul`/`li` tiles with placement subtitles and Pathway jump scroll targets (`data-course-key`).

## axe-core (2026-08-04) — v3.5.1 UI polish

Run: `ZTC_PROG_CSV=…/Program Summary 2026-08-03_113716.csv python3 scripts/run-axe-v3.py http://localhost:8767/index.html`

**Result:** **0 WCAG 2.1 AA violations** across **10 UI states**, including Pathway lab-ref/choice bands, Dashboard five-KPI overview row, and Courses “In pathways” membership tiles.

## axe-core (2026-08-04) — v3.5 pathway fidelity

Run: `ZTC_PROG_CSV=…/Program Summary 2026-08-03_113716.csv python3 scripts/run-axe-v3.py http://localhost:8767/index.html`

**Result:** **0 WCAG 2.1 AA violations** across **10 UI states** (same harness as v3.4), including Pathway view with lab-reference callouts and Either/Or/And option bundles.

## axe-core (2026-06-19)

Run: `python3 scripts/run-axe-v3.py http://localhost:8767/index.html`

**Result:** 0 WCAG 2.1 AA violations across Landing, Dashboard, Pathway, Courses, course panel, and course modal (dark + light themes).

Light-theme contrast fix: `THEME.light.faint` → `text-gray-600`; course stat labels use `text-gray-700` on tinted cards in light mode.

## axe-core (2026-06-29) — drag-and-drop + catalog note regression

Run: `python3 scripts/run-axe-v3.py http://localhost:8767/index.html` (local server on port 8767; production CSV fixtures).

**Result:** **0 WCAG 2.1 AA violations** across **10 UI states**:

| State | Violations |
|-------|------------|
| Landing (dark) | 0 |
| Landing (light) | 0 |
| Landing (both CSVs staged, light) | 0 |
| Dashboard (dark, data loaded) | 0 |
| Pathway view | 0 |
| Courses view | 0 |
| Courses view (oldest term, catalog note) | 0 |
| Course detail panel | 0 |
| Course detail modal | 0 |
| Dashboard (light, data loaded) | 0 |

**Fixes in this pass:** Catalog availability note uses `role="note"` with `tabIndex={0}` and `focus-visible` ring so the scrollable main region retains keyboard access when the catalog link is hidden. Harness waits for both CSVs to finish parsing before scanning the staged landing state.
