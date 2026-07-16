#!/usr/bin/env bash
# Deterministic reproducer of the roadmapsmith value proposition:
# agent claims [x] on a task without writing code, validator catches it.
# Used by the demo GIF and by roadmap-skill/scripts/e2e-smoke.sh.
set -euo pipefail

CLI="${ROADMAPSMITH_BIN:-roadmapsmith}"

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

cd "$WORK"
git init -q
git config user.email demo@repro.test
git config user.name  Demo
echo "// stub" > app.js
git add . && git commit -q -m init

$CLI init --product-name Demo --primary-user dev --problem-statement demo --project-root . >/dev/null

$CLI update --add-task "Add SHA-256 password hashing" --project-root . --json > /dev/null
sed -i "s|- \[ \] Add SHA-256|- [x] Add SHA-256|" ROADMAP.md

echo ">>> Frame 1 — agent claim on disk (no implementation written):"
grep "SHA-256" ROADMAP.md
echo

echo ">>> Frame 2 — validator audit:"
$CLI update --audit --project-root . --json > audit.json 2>/dev/null || true
if command -v jq >/dev/null 2>&1; then
  CWE_COUNT=$(jq -r '.checkedWithoutEvidence | length' audit.json)
  CWE_TASK=$(jq -r '.checkedWithoutEvidence[0].task.id // "none"' audit.json)
else
  CWE_COUNT=$(node -e "console.log((JSON.parse(require('fs').readFileSync('audit.json','utf8')).checkedWithoutEvidence||[]).length)")
  CWE_TASK=$(node -e "const d=(JSON.parse(require('fs').readFileSync('audit.json','utf8')).checkedWithoutEvidence||[]);console.log(d[0]&&d[0].task?d[0].task.id:'none')")
fi
echo "checkedWithoutEvidence: $CWE_COUNT"
echo

echo ">>> Frame 3 — caught task:"
echo "  id: $CWE_TASK"

test "$CWE_COUNT" = "1" || { echo "FAIL: expected checkedWithoutEvidence=1, got $CWE_COUNT"; exit 1; }
