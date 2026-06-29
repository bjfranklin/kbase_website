#!/usr/bin/env bash
# Re-download vendored JS from pinned upstream URLs in vendor/deps.json.
# After fetch, recompute sha384 hashes and update the manifest.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEPS="${ROOT}/vendor/deps.json"

if [[ ! -f "${DEPS}" ]]; then
  echo "error: missing ${DEPS}" >&2
  exit 1
fi

export ROOT
python3 - <<'PY'
import json
import os
import subprocess
from pathlib import Path

root = Path(os.environ["ROOT"])
deps_path = root / "vendor" / "deps.json"
manifest = json.loads(deps_path.read_text(encoding="utf-8"))

for dep in manifest.get("vendored", []):
    rel = dep["file"]
    dest = root / rel
    url = dep["source"]
    print(f"fetch {dep['name']}@{dep['version']} -> {rel}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["curl", "-fsSL", "-o", str(dest), url], check=True)
    out = subprocess.run(
        ["shasum", "-a", "384", str(dest)],
        check=True,
        capture_output=True,
        text=True,
    )
    dep["sha384"] = out.stdout.split()[0]

deps_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print(f"updated hashes in {deps_path}")
PY

echo "Run: python3 scripts/check-deps.py"
