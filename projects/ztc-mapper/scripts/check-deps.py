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
    re.compile(r"cdn\.tailwindcss\.com"),
)

SCRIPT_TAG_RE = re.compile(r"<script\b([^>]*)>", re.IGNORECASE)


def sha384_hex(path: Path) -> str:
    digest = hashlib.sha384()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_script_attrs(tag_inner: str) -> dict[str, str]:
    attrs: dict[str, str] = {}
    for match in re.finditer(
        r'(\w[\w-]*)\s*=\s*"([^"]*)"|(\w[\w-]*)\s*=\s*\'([^\']*)\'|(\w[\w-]*)',
        tag_inner,
    ):
        if match.group(1):
            attrs[match.group(1).lower()] = match.group(2)
        elif match.group(3):
            attrs[match.group(3).lower()] = match.group(4)
        elif match.group(5):
            attrs[match.group(5).lower()] = ""
    return attrs


def main() -> int:
    errors: list[str] = []

    if not DEPS_FILE.is_file():
        errors.append(f"missing manifest: {DEPS_FILE}")
        print("\n".join(errors))
        return 1

    manifest = json.loads(DEPS_FILE.read_text(encoding="utf-8"))
    index_html = INDEX.read_text(encoding="utf-8")

    dep_by_file = {dep["file"]: dep for dep in manifest.get("vendored", [])}

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

    vendored_paths = set(dep_by_file)
    for tag_inner in SCRIPT_TAG_RE.findall(index_html):
        attrs = parse_script_attrs(tag_inner)
        src = attrs.get("src", "")
        if not src.startswith("vendor/"):
            continue
        if src not in vendored_paths:
            errors.append(f"index.html references unknown vendor path: {src}")
        if "crossorigin" in attrs:
            errors.append(f"{src} must not use crossorigin (breaks file:// opens)")
        if "integrity" in attrs:
            errors.append(
                f"{src} must not use integrity attribute (breaks file:// opens; "
                "sha384 verified by this script instead)"
            )

    cdn_only = manifest.get("cdn_only", [])
    if cdn_only:
        names = ", ".join(item.get("name", "?") for item in cdn_only)
        errors.append(f"deps.json still lists cdn_only entries: {names}")

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
