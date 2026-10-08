#!/usr/bin/env python3
"""Geometry, keyboard, selection, and responsive regressions for the v3.5.7 Dashboard."""

from __future__ import annotations

import http.server
import json
import os
import re
import socketserver
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIXTURE = Path(__file__).resolve().parent / "fixtures" / "dashboard-panel-session.json"
STORAGE_KEY = "ztc-pathway-mapper-v3"
VIEWPORTS = (
    ("desktop", 1280, 800),
    ("laptop", 1024, 768),
    ("tablet", 768, 900),
    ("boundary", 640, 844),
    ("sub-boundary", 639, 844),
    ("narrow", 390, 844),
)


def _load_session() -> str:
    payload = json.loads(FIXTURE.read_text(encoding="utf-8"))
    return json.dumps(payload)


def _serve(directory: Path) -> tuple[socketserver.TCPServer, str]:
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(directory), **kwargs)

        def log_message(self, format: str, *args) -> None:
            return

    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", 0), Quiet)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    host, port = httpd.server_address
    return httpd, f"http://{host}:{port}/index.html"


def _box(locator) -> dict:
    box = locator.bounding_box()
    assert box is not None, f"missing bounding box for {locator}"
    return box


def _assert_geometry(page, label: str) -> None:
    tab = page.locator("[data-dashboard-pullout]")
    sidebar = page.locator("[data-sidebar-column]")
    dashboard = page.locator("#dashboard-panel")
    main = page.locator("[data-reading-pane]")
    t = _box(tab)
    s = _box(sidebar)
    d = _box(dashboard)
    m = _box(main)
    assert t["x"] <= 1, f"{label}: Dashboard tab is not anchored to the left edge"
    assert t["height"] > t["width"], (
        f"{label}: Dashboard trigger is not a vertical pullout tab"
    )
    assert t["x"] + t["width"] <= s["x"] + 1, (
        f"{label}: Dashboard tab rail overlaps the sidebar"
    )
    assert abs(d["width"] - s["width"]) <= 1, (
        f"{label}: dashboard width {d['width']} != sidebar width {s['width']}"
    )
    assert d["x"] + d["width"] <= m["x"] + 1, (
        f"{label}: dashboard right edge {d['x'] + d['width']} crosses main left {m['x']}"
    )
    probe_x = m["x"] + min(8, max(m["width"] / 4, 2))
    probe_y = m["y"] + min(40, max(m["height"] / 4, 2))
    hit = page.evaluate(
        """([x, y]) => {
            const el = document.elementFromPoint(x, y);
            if (!el) return null;
            if (el.closest('#dashboard-panel')) return 'dashboard';
            if (el.closest('[data-reading-pane]')) return 'main';
            if (el.closest('[data-sidebar-column]')) return 'sidebar';
            return el.tagName;
        }""",
        [probe_x, probe_y],
    )
    assert hit == "main", (
        f"{label}: reading pane is covered at ({probe_x}, {probe_y}) -> {hit}"
    )


def _rect(locator) -> dict:
    return locator.evaluate(
        """el => {
            const r = el.getBoundingClientRect();
            return {x: r.x, y: r.y, width: r.width, height: r.height, visibility: getComputedStyle(el).visibility};
        }"""
    )


def _assert_primary_canvas(page, label: str, viewport_width: int) -> None:
    tab = page.locator("[data-dashboard-pullout]")
    sidebar = page.locator("[data-sidebar-column]")
    main = page.locator("[data-reading-pane]")
    t = _box(tab)
    s = _box(sidebar)
    m = _rect(main)
    assert t["x"] <= 1, f"{label}: Dashboard tab is not anchored to the left edge"
    assert abs(s["x"] - t["width"]) <= 1, (
        f"{label}: sidebar does not begin after the rail"
    )
    assert abs(s["width"] - (viewport_width - t["width"])) <= 1, (
        f"{label}: Dashboard canvas width {s['width']} does not fill available width"
    )
    assert m["width"] <= 1 and m["visibility"] == "hidden", (
        f"{label}: reading pane was not visually hidden ({m})"
    )
    assert main.get_attribute("aria-hidden") == "true"
    assert main.get_attribute("inert") is not None


def _assert_inactive_nav(page) -> None:
    nav = page.locator("#sidebar-nav-panel")
    assert nav.get_attribute("inert") is not None
    assert nav.get_attribute("aria-hidden") == "true"
    tabbable = page.evaluate(
        """() => {
            const root = document.getElementById('sidebar-nav-panel');
            const nodes = root.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
            return Array.from(nodes).filter((el) => {
                const style = window.getComputedStyle(el);
                if (style.visibility === 'hidden' || style.display === 'none') return false;
                return el.tabIndex >= 0;
            }).map((el) => el.getAttribute('aria-label') || el.textContent.trim()).slice(0, 5);
        }"""
    )
    assert tabbable == [], (
        f"inactive navigation remained keyboard-focusable: {tabbable}"
    )


def _open_dashboard(page):
    toggle = page.get_by_role("button", name="Dashboard", exact=True)
    toggle.click()
    page.wait_for_timeout(250)
    assert toggle.get_attribute("aria-expanded") == "true"
    assert page.locator("#dashboard-panel").get_attribute("aria-hidden") in (
        None,
        "false",
    )
    return toggle


def _launch_chromium(playwright):
    env_path = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
    if env_path and Path(env_path).is_file():
        return playwright.chromium.launch(headless=True, executable_path=env_path)
    try:
        return playwright.chromium.launch(headless=True)
    except Exception:
        cache = Path.home() / "Library" / "Caches" / "ms-playwright"
        shells = sorted(
            cache.glob(
                "chromium_headless_shell-*/chrome-headless-shell-*/chrome-headless-shell"
            )
        )
        if not shells:
            raise
        return playwright.chromium.launch(
            headless=True, executable_path=str(shells[-1])
        )


def main() -> int:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("SKIP: playwright is not installed")
        return 0

    session = _load_session()
    httpd, url = _serve(ROOT)
    failures: list[str] = []
    try:
        with sync_playwright() as p:
            browser = _launch_chromium(p)
            page = browser.new_page()
            page.add_init_script(f"localStorage.setItem({STORAGE_KEY!r}, {session!r});")
            page.goto(url, wait_until="networkidle")
            page.get_by_role("navigation", name="Views").get_by_role(
                "button", name="Pathway", exact=True
            ).wait_for()
            heading = page.locator("#main-content h2").first
            heading.wait_for()
            initial_program = heading.inner_text().strip()
            assert initial_program == "Alpha Biology A.S."

            views = page.get_by_role("navigation", name="Views")
            assert (
                views.get_by_role("button", name="Dashboard", exact=True).count() == 0
            )
            assert (
                page.get_by_role("banner")
                .get_by_role("button", name="Dashboard", exact=True)
                .count()
                == 0
            )

            toggle = page.get_by_role("button", name="Dashboard", exact=True)
            assert toggle.get_attribute("aria-expanded") == "false"
            assert toggle.get_attribute("aria-controls") == "dashboard-panel"

            page.get_by_role("button", name="Export data").click()
            menu = page.get_by_role("menu", name="Export options")
            menu.wait_for()
            assert (
                menu.get_by_role("menuitem", name="Current pathway (CSV)").count() == 1
            )
            page.keyboard.press("Escape")

            for name, width, height in VIEWPORTS:
                page.set_viewport_size({"width": width, "height": height})
                page.wait_for_timeout(150)
                main_before = _box(page.locator("[data-reading-pane]"))
                selected_before = (
                    page.locator("#main-content h2").first.inner_text().strip()
                )
                toggle = _open_dashboard(page)
                try:
                    _assert_inactive_nav(page)
                    selected_open = (
                        page.locator("#main-content h2").first.text_content().strip()
                    )
                    if width < 640:
                        _assert_primary_canvas(page, f"{name} open", width)
                    else:
                        _assert_geometry(page, f"{name} open")
                        main_open = _box(page.locator("[data-reading-pane]"))
                        assert abs(main_open["width"] - main_before["width"]) <= 1, (
                            f"{name}: main pane width changed {main_before['width']} -> {main_open['width']}"
                        )
                        assert (
                            page.locator("[data-reading-pane]").get_attribute(
                                "aria-hidden"
                            )
                            is None
                        )
                        assert (
                            page.locator("[data-reading-pane]").get_attribute("inert")
                            is None
                        )
                    assert selected_open == selected_before, (
                        f"{name}: selection changed {selected_before!r} -> {selected_open!r}"
                    )
                    page.keyboard.press("Escape")
                    page.wait_for_timeout(200)
                    assert toggle.get_attribute("aria-expanded") == "false"
                    focused = page.evaluate(
                        "() => document.activeElement && document.activeElement.id"
                    )
                    assert focused == "dashboard-toggle", (
                        f"{name}: Escape did not restore toggle focus ({focused!r})"
                    )
                    main_after = _box(page.locator("[data-reading-pane]"))
                    selected_after = (
                        page.locator("#main-content h2").first.inner_text().strip()
                    )
                    assert abs(main_after["width"] - main_before["width"]) <= 1, (
                        f"{name}: closing Dashboard resized the reading pane"
                    )
                    assert selected_after == selected_before, (
                        f"{name}: closing Dashboard changed the selection"
                    )
                except AssertionError as exc:
                    failures.append(str(exc))
                    if toggle.get_attribute("aria-expanded") == "true":
                        page.keyboard.press("Escape")

            page.set_viewport_size({"width": 1280, "height": 800})
            _open_dashboard(page)
            assert (
                page.get_by_role(
                    "button", name=re.compile("^Average ZTC adoption:")
                ).count()
                == 1
            )
            page.get_by_role("button", name="Explain Average ZTC adoption").click()
            explainer = page.get_by_role("dialog", name="Average ZTC adoption")
            assert (
                explainer.get_by_role("heading", name="What this metric means").count()
                == 1
            )
            assert (
                explainer.get_by_role("heading", name="How it is calculated").count()
                == 1
            )
            explainer.get_by_role(
                "button", name="Close Average ZTC adoption explainer"
            ).click()
            page.get_by_role("button", name="Explore pathway details").click()
            assert page.locator("#dashboard-comparison-details").count() == 1
            assert (
                page.get_by_role(
                    "img", name=re.compile("Distribution by ZTC-ability")
                ).count()
                == 1
            )
            page.get_by_role("button", name="View trend details").click()
            page.wait_for_timeout(200)
            trend_dialog = page.get_by_role("dialog", name="ZTC adoption trend")
            assert trend_dialog.count() == 1
            assert (
                page.get_by_role("button", name="Dashboard", exact=True).get_attribute(
                    "aria-expanded"
                )
                == "true"
            )
            assert (
                page.locator("#main-content h2").first.inner_text().strip()
                == initial_program
            )
            trend_dialog.get_by_role("button", name="Close adoption trend").click()
            page.get_by_role("button", name="View trend details").click()
            trend_dialog = page.get_by_role("dialog", name="ZTC adoption trend")
            trend_dialog.locator("..").click(position={"x": 5, "y": 5})
            assert page.get_by_role("dialog", name="ZTC adoption trend").count() == 0

            page.get_by_role(
                "button",
                name="Zeta Chemistry Certificate. ZTC adoption 0%. Open pathway view.",
            ).click()
            page.wait_for_timeout(250)
            assert (
                page.get_by_role("button", name="Dashboard", exact=True).get_attribute(
                    "aria-expanded"
                )
                == "false"
            )
            assert (
                page.locator("#main-content h2").first.inner_text().strip()
                == "Zeta Chemistry Certificate"
            )

            page.get_by_role("button", name="Switch to light mode").click()
            _open_dashboard(page)
            _assert_geometry(page, "light theme")
            page.get_by_role("navigation", name="Views").get_by_role(
                "button", name="Courses", exact=True
            ).click()
            page.wait_for_timeout(200)
            assert (
                page.locator("#main-content h2").first.inner_text().strip() == "BIOL-1"
            )
            page.keyboard.press("Escape")
            browser.close()
    finally:
        httpd.shutdown()
        httpd.server_close()

    if failures:
        print("FAIL")
        for item in failures:
            print(item)
        return 1
    print("Dashboard panel UI regressions passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
