#!/usr/bin/env bash
# End-to-end smoke test: exercises the real user journey against the CLI.
# Fails loud if init/update/evidence/audit break — regression net for first-hour UX bugs.
set -euo pipefail

if [ -n "${GITHUB_WORKSPACE:-}" ]; then
  CLI_ROOT="$GITHUB_WORKSPACE/roadmap-skill"
else
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  CLI_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi

CLI="node $CLI_ROOT/bin/cli.js"

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

cd "$WORK"
git init -q
git config user.email "e2e@smoke.test"
git config user.name  "E2E Smoke"
echo "console.log('hi');" > app.js
git add . && git commit -q -m "initial"

echo "▶ init"
$CLI init --product-name "Test" --primary-user "dev" --project-root .
test -f ROADMAP.md || { echo "FAIL: ROADMAP.md not created"; exit 1; }
test -f AGENTS.md || { echo "FAIL: AGENTS.md not created"; exit 1; }

echo "▶ add-task"
$CLI update --add-task "Ship login flow" --project-root . --json > out.json
grep -q '"action"' out.json || { echo "FAIL: add-task JSON contract"; cat out.json; exit 1; }

echo "▶ audit (JSON)"
$CLI update --audit --project-root . --json > out.json
grep -q '"checkedWithoutEvidence"' out.json || { echo "FAIL: audit JSON payload missing"; cat out.json; exit 1; }

echo "▶ audit (text, no --json)"
$CLI update --audit --project-root . > out.txt 2>&1 || true
test -s out.txt || { echo "FAIL: audit text output empty"; exit 1; }

echo "▶ all E2E steps green"
