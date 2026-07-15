#!/usr/bin/env bash
# End-to-end smoke test: exercises the real user journey against the CLI.
# Fails loud if init/update/evidence/audit break — regression net for first-hour UX bugs.
set -euo pipefail

if [ -n "${GITHUB_WORKSPACE:-}" ]; then
  CLI_ROOT="$GITHUB_WORKSPACE/roadmap-skill"
  REPO_ROOT="$GITHUB_WORKSPACE"
else
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  CLI_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
  REPO_ROOT="$(cd "$CLI_ROOT/.." && pwd)"
fi

CLI="node $CLI_ROOT/bin/cli.js"

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

cd "$WORK"
git init -q
git config user.email "e2e@smoke.test"
git config user.name  "E2E Smoke"
# v0.15.0: init needs ≥3 named functions to exercise the dynamic (scan-based)
# path — under that threshold it falls back to the empty-repo minimal shape,
# and the "task lines name real functions" contract would be untested.
cat > app.js <<'JSEOF'
function greetUser(name) { return `Hello ${name}`; }
function sayGoodbye(name) { return `Bye ${name}`; }
function processInput(x) { return x; }
JSEOF
git add . && git commit -q -m "initial"

echo "▶ init"
$CLI init --product-name "Test" --primary-user "dev" --project-root .
test -f ROADMAP.md || { echo "FAIL: ROADMAP.md not created"; exit 1; }
test -f AGENTS.md || { echo "FAIL: AGENTS.md not created"; exit 1; }

# v0.15.0: dynamic init must emit tasks that name real functions from the
# scanned code — if this grep stops matching, `init` has silently regressed
# to phaseTemplate boilerplate.
echo "▶ init produced dynamic task naming a real function"
grep -q "greetUser" ROADMAP.md || { echo "FAIL: ROADMAP.md missing dynamic task for greetUser"; cat ROADMAP.md; exit 1; }
grep -q "app.js" ROADMAP.md || { echo "FAIL: ROADMAP.md missing file reference to app.js"; cat ROADMAP.md; exit 1; }

echo "▶ add-task"
$CLI update --add-task "Ship login flow" --project-root . --json > out.json
grep -q '"action"' out.json || { echo "FAIL: add-task JSON contract"; cat out.json; exit 1; }

# v0.15.0: pipeability chain — add-task must return .task.id so callers can
# chain into --evidence without grep-ing ROADMAP.md.
echo "▶ add-task → id → evidence chain"
if command -v jq >/dev/null 2>&1; then
  TASK_ID=$(jq -r .task.id out.json)
else
  # Fallback for CI images without jq: extract .task.id via node.
  TASK_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('out.json','utf8')).task.id)")
fi
test -n "$TASK_ID" && [ "$TASK_ID" != "null" ] || { echo "FAIL: task.id missing in add-task JSON"; cat out.json; exit 1; }
$CLI update --task "$TASK_ID" --evidence "src/auth/login.ts" --project-root . >/dev/null
grep -q "Evidence: src/auth/login.ts" ROADMAP.md || { echo "FAIL: --evidence chain did not append the line"; exit 1; }

echo "▶ audit (JSON)"
$CLI update --audit --project-root . --json > out.json
grep -q '"checkedWithoutEvidence"' out.json || { echo "FAIL: audit JSON payload missing"; cat out.json; exit 1; }

echo "▶ audit (text, no --json)"
$CLI update --audit --project-root . > out.txt 2>&1 || true
test -s out.txt || { echo "FAIL: audit text output empty"; exit 1; }

# v0.15.0: the value-prop demo (agent claims [x] without evidence → audit catches it)
# is executable and must stay green — if the "catch" stops firing, the tool has
# lost the property that justifies its existence.
echo "▶ false-claim demo repro"
REPRO="$REPO_ROOT/scripts/demo/false-claim-repro.sh"
test -f "$REPRO" || { echo "FAIL: $REPRO missing"; exit 1; }
ROADMAPSMITH_BIN="$CLI" bash "$REPRO" > repro.out 2>&1 || { echo "FAIL: repro exited non-zero"; cat repro.out; exit 1; }
grep -q "checkedWithoutEvidence: 1" repro.out || { echo "FAIL: repro did not report checkedWithoutEvidence: 1"; cat repro.out; exit 1; }

echo "▶ all E2E steps green"
