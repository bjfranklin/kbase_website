#!/usr/bin/env python3
"""Run axe-core WCAG 2.1 AA checks on ZTC Pathway Mapper v3 UI states."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8767/index.html"
PROG_CSV = Path(os.environ.get(
    "ZTC_PROG_CSV",
    Path.home() / "Downloads" / "Program Summary 2026-05-29_100422.csv",
))
ANAL_CSV = Path(os.environ.get(
    "ZTC_ANAL_CSV",
    Path.home() / "Downloads" / "IE - ZTC Course Analytics - MASTER (BF).csv",
))
AXE_CDN = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js"


def run_axe(page, label: str) -> dict:
    result = page.evaluate(
        """async () => {
            return await axe.run(document, {
                runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] }
            });
        }"""
    )
    violations = result.get("violations", [])
    return {
        "label": label,
        "violations": len(violations),
        "items": [
            {
                "id": v["id"],
                "impact": v["impact"],
                "help": v["help"],
                "nodes": len(v.get("nodes", [])),
            }
            for v in violations
        ],
    }


def main() -> None:
    if not PROG_CSV.is_file() or not ANAL_CSV.is_file():
        print(json.dumps({"error": "CSV fixtures not found", "prog": str(PROG_CSV), "anal": str(ANAL_CSV)}))
        sys.exit(1)

    report: list[dict] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(BASE, wait_until="networkidle")
        page.add_script_tag(url=AXE_CDN)

        report.append(run_axe(page, "Landing (dark)"))
        page.get_by_role("button", name="Toggle theme").click()
        page.wait_for_timeout(300)
        report.append(run_axe(page, "Landing (light)"))

        page.locator('input[aria-label="Upload Program Summary CSV"]').set_input_files(str(PROG_CSV))
        page.locator('input[aria-label="Upload Course Analytics CSV"]').set_input_files(str(ANAL_CSV))
        page.get_by_text("Loaded ·", exact=False).nth(1).wait_for(timeout=120_000)
        page.wait_for_timeout(500)
        report.append(run_axe(page, "Landing (both CSVs staged, light)"))

        page.get_by_role("button", name="Build dashboard").click()
        page.get_by_role("navigation", name="Views").get_by_role("button", name="Dashboard", exact=True).wait_for(timeout=120_000)
        page.wait_for_timeout(800)
        report.append(run_axe(page, "Dashboard (dark, data loaded)"))

        page.get_by_role("navigation", name="Views").get_by_role("button", name="Pathway", exact=True).click()
        page.wait_for_timeout(500)
        report.append(run_axe(page, "Pathway view"))

        page.get_by_role("navigation", name="Views").get_by_role("button", name="Courses", exact=True).click()
        page.wait_for_timeout(500)
        report.append(run_axe(page, "Courses view"))

        page.get_by_role("button", name="Select term").click()
        page.wait_for_timeout(200)
        page.locator('ul[role="listbox"][aria-label="Select term"] button[role="option"]').first.click()
        page.wait_for_timeout(500)
        report.append(run_axe(page, "Courses view (oldest term, catalog note)"))

        course_btn = page.locator("aside ul li button").first
        if course_btn.count():
            course_btn.click()
            page.wait_for_timeout(400)
            report.append(run_axe(page, "Course detail panel"))

        page.get_by_role("navigation", name="Views").get_by_role("button", name="Pathway", exact=True).click()
        page.wait_for_timeout(400)
        course_row = page.locator('[id^="area-"] button').first
        if course_row.count():
            course_row.click()
            page.get_by_role("dialog").wait_for(timeout=5000)
            page.wait_for_timeout(400)
            report.append(run_axe(page, "Course detail modal"))
            page.get_by_role("button", name="Close course details").click()

        # light theme with data
        theme_btn = page.get_by_role("button", name="Switch to light mode")
        if not theme_btn.count():
            theme_btn = page.get_by_role("button", name="Switch to dark mode")
        theme_btn.click()
        page.wait_for_timeout(300)
        page.get_by_role("navigation", name="Views").get_by_role("button", name="Dashboard", exact=True).click()
        page.wait_for_timeout(400)
        report.append(run_axe(page, "Dashboard (light, data loaded)"))

        browser.close()

    total = sum(r["violations"] for r in report)
    print(json.dumps({"totalViolations": total, "report": report}, indent=2))


if __name__ == "__main__":
    main()
