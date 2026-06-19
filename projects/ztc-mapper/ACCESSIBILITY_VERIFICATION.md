# Accessibility Verification — v3.0

> Historical v2.3 line-level audit: see vault `2-projects/ztc-pathway-mapper/ZTC-Pathway-Mapper-ACCESSIBILITY_VERIFICATION.md`.

## axe-core (2026-06-19)

Run: `python3 scripts/run-axe-v3.py http://localhost:8767/index.html`

**Result:** 0 WCAG 2.1 AA violations across Landing, Dashboard, Pathway, Courses, course panel, and course modal (dark + light themes).

Light-theme contrast fix: `THEME.light.faint` → `text-gray-600`; course stat labels use `text-gray-700` on tinted cards in light mode.
