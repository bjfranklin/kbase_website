# Accessibility Verification — v3.4

> Historical v2.3 line-level audit: see vault `2-projects/ztc-pathway-mapper/ZTC-Pathway-Mapper-ACCESSIBILITY_VERIFICATION.md`.

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
