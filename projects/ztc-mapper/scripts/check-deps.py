#!/usr/bin/env python3
"""Verify vendored JS matches vendor/deps.json and index.html references."""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEPS_FILE = ROOT / "vendor" / "deps.json"
INDEX = ROOT / "index.html"

FLOATING_CDN_PATTERNS = (
    re.compile(r"unpkg\.com/react@18(?!\.2\.0)"),
    re.compile(r"unpkg\.com/react-dom@18(?!\.2\.0)"),
    re.compile(r"@babel/standalone(?!@7\.23\.5)"),
    re.compile(r"react@18/umd"),
)


def sha384_hex(path: Path) -> str:
    digest = hashlib.sha384()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    errors: list[str] = []

    if not DEPS_FILE.is_file():
        errors.append(f"missing manifest: {DEPS_FILE}")
        print("\n".join(errors))
        return 1

    manifest = json.loads(DEPS_FILE.read_text(encoding="utf-8"))
    index_html = INDEX.read_text(encoding="utf-8")

    for dep in manifest.get("vendored", []):
        rel = dep["file"]
        path = ROOT / rel
        if not path.is_file():
            errors.append(f"missing vendor file: {rel}")
            continue
        actual = sha384_hex(path)
        expected = dep.get("sha384", "")
        if expected and actual != expected:
            errors.append(f"hash mismatch for {rel}: expected {expected[:16]}… got {actual[:16]}…")
        if rel not in index_html:
            errors.append(f"index.html does not reference {rel}")

    for pattern in FLOATING_CDN_PATTERNS:
        if pattern.search(index_html):
            errors.append(f"index.html still uses floating CDN URL matching {pattern.pattern}")

    vendored_paths = {dep["file"] for dep in manifest.get("vendored", [])}
    script_srcs = re.findall(r'<script[^>]+src="([^"]+)"', index_html)
    for src in script_srcs:
        if src.startswith("vendor/") and src not in vendored_paths:
            errors.append(f"index.html references unknown vendor path: {src}")

    if errors:
        print("check-deps: FAIL")
        for err in errors:
            print(f"  - {err}")
        return 1

    app_version = manifest.get("app_version", "?")
    count = len(manifest.get("vendored", []))
    print(f"check-deps: OK — {count} vendored deps verified (app v{app_version})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
