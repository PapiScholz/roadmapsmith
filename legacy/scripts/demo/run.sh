#!/usr/bin/env bash
set -euo pipefail

# roadmapsmith dogfood demo: compare a claude-code session that reads ROADMAP.md
# against one that doesn't. Emits transcripts, audit lines, and a summary.

REPO_ROOT="$(git rev-parse --show-toplevel)"
DEMO_DIR="$REPO_ROOT/scripts/demo"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="$DEMO_DIR/out-$STAMP"
mkdir -p "$OUT_DIR"

command -v claude >/dev/null 2>&1 || {
  echo "ERROR: 'claude' CLI not on PATH. Install claude-code first."
  exit 1
}

WT_A="$OUT_DIR/worktree-with-roadmap"
WT_B="$OUT_DIR/worktree-without-roadmap"
git worktree add "$WT_A" HEAD >/dev/null
git worktree add "$WT_B" HEAD >/dev/null

echo ">>> Session A: claude sees ROADMAP.md"
(
  cd "$WT_A"
  claude -p "$(cat "$DEMO_DIR/prompt-with-roadmap.md")" \
    --output-format text \
    2>&1 | tee "$OUT_DIR/transcript-with-roadmap.txt"
) || echo "(session A exited non-zero — continuing)"

echo ">>> Session B: claude does NOT see ROADMAP.md"
mv "$WT_B/ROADMAP.md" "$WT_B/.ROADMAP.md.hidden"
(
  cd "$WT_B"
  claude -p "$(cat "$DEMO_DIR/prompt-without-roadmap.md")" \
    --output-format text \
    2>&1 | tee "$OUT_DIR/transcript-without-roadmap.txt"
) || echo "(session B exited non-zero — continuing)"
mv "$WT_B/.ROADMAP.md.hidden" "$WT_B/ROADMAP.md" 2>/dev/null || true

measure() {
  local wt="$1"
  local label="$2"
  local evidence_count audit_line tests_line files_touched
  evidence_count=$(grep -c '^  - Evidence:' "$wt/ROADMAP.md" 2>/dev/null || echo 0)
  audit_line=$(cd "$wt/roadmap-skill" && node bin/cli.js update --project-root .. --audit --dry-run 2>&1 | grep -E "Audit summary" || echo "(no audit line captured)")
  tests_line=$(cd "$wt/roadmap-skill" && node --test test/*.test.js 2>&1 | tail -8 | grep -E "^# (pass|fail|tests)" | tr '\n' ' ' || echo "(tests missing)")
  files_touched=$(cd "$wt" && git diff --name-only HEAD 2>/dev/null | wc -l | tr -d ' ')
  cat <<EOM
## $label
- Evidence: bullets added: $evidence_count
- $audit_line
- Tests: $tests_line
- Files touched: $files_touched
EOM
}

{
  echo "# Dogfood demo run — $STAMP"
  echo
  measure "$WT_A" "Session A (with ROADMAP.md)"
  echo
  measure "$WT_B" "Session B (without ROADMAP.md)"
  echo
  echo "## Interpretation"
  echo
  echo "Both sessions can modify code. What ROADMAP.md adds is an auditable"
  echo "trail: which tasks were closed, why, and with what evidence. Session B"
  echo "may write good code but leaves no evidence log to validate against."
  echo
  echo "Transcripts:"
  echo "- $OUT_DIR/transcript-with-roadmap.txt"
  echo "- $OUT_DIR/transcript-without-roadmap.txt"
} | tee "$OUT_DIR/summary.md"

git worktree remove "$WT_A" --force
git worktree remove "$WT_B" --force

echo
echo "Done. Full output: $OUT_DIR/"
