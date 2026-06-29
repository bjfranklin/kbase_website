#!/usr/bin/env bash
# One-time maintainer step: scan index.html class names and emit vendor/tailwind.min.css.
# End users open index.html directly — no runtime build step.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUT="${ROOT}/vendor/tailwind.min.css"
INPUT="${ROOT}/scripts/tailwind-input.css"
CONFIG="${ROOT}/tailwind.config.js"

cd "${ROOT}"
npx --yes tailwindcss@3.4.17 -i "${INPUT}" -o "${OUT}" --minify -c "${CONFIG}"

export ROOT
python3 - <<'PY'
import hashlib
import json
import os
from datetime import date
from pathlib import Path

root = Path(os.environ["ROOT"])
css = root / "vendor" / "tailwind.min.css"
deps_path = root / "vendor" / "deps.json"
digest = hashlib.sha384(css.read_bytes()).hexdigest()
manifest = json.loads(deps_path.read_text(encoding="utf-8"))
for dep in manifest.get("vendored", []):
    if dep.get("name") == "tailwindcss":
        dep["sha384"] = digest
        break
else:
    raise SystemExit("tailwindcss entry missing from vendor/deps.json")
manifest["updated"] = date.today().isoformat()
deps_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print(f"updated sha384 in {deps_path}")
PY

echo "Generated ${OUT}"
echo "Run: python3 scripts/check-deps.py"
