# Use Case: CI Audit Mode

## Who uses it

Teams that want automated enforcement of roadmap accuracy in pull requests:
- Developers using GitHub Actions, GitLab CI, or any CI runner
- Teams that want to prevent unchecked tasks from merging with false completion claims
- Projects where AI agents mark tasks complete and humans need a trust layer

## When to use it

Use CI Audit Mode when:

- You want PRs to fail if tasks are marked `[x]` without repository evidence
- An AI agent session just completed work and you want a factual status report
- You have a team policy that completion state must match code evidence before merge
- You want to surface tasks that have evidence but have not been checked yet

Do not use CI Audit Mode as a substitute for running `roadmapsmith sync` locally — run sync first, then let CI confirm the outcome.

## How it works

`roadmapsmith sync --audit` compares the declared task state in `ROADMAP.md` against repository evidence without modifying the file. It exits with a non-zero status code when mismatches are found, which fails the CI job.

### Mismatch types detected

- **Checked without evidence** — task is marked `[x]` but no code, test, or artifact supports it
- **Evidence present but unchecked** — task has strong evidence but is still marked `[ ]`

## Workflow

```bash
# In CI (GitHub Actions, GitLab CI, etc.)
node roadmap-skill/bin/cli.js sync --audit
```

This command:
1. Scans the repository for evidence per task
2. Compares evidence against the checked state in `ROADMAP.md`
3. Prints a mismatch report to stdout
4. Exits 1 if any mismatch is found; exits 0 if the roadmap is consistent

### GitHub Actions example

```yaml
name: Roadmap Audit

on: [pull_request]

jobs:
  roadmap-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci --prefix roadmap-skill
      - run: node roadmap-skill/bin/cli.js sync --audit
```

### GitLab CI example

```yaml
roadmap-audit:
  stage: test
  script:
    - npm ci --prefix roadmap-skill
    - node roadmap-skill/bin/cli.js sync --audit
```

## Interpreting the audit output

A passing audit looks like:

```
✓ Roadmap audit passed — all checked tasks have evidence
```

A failing audit includes a per-task breakdown:

```
⚠ Roadmap audit failed

Checked without evidence:
  - prof-task-add-ci-audit-docs: "Add docs/use-cases/ci-audit.md" — no file match found

Evidence present but unchecked:
  - prof-task-add-output-format: "Define stable public output format" — matched in src/renderer/index.js
```

## Guardrails enforced

- CI Audit does not modify `ROADMAP.md` — it is a read-only check
- The managed block is the only section evaluated; unmanaged content is ignored
- Task IDs are stable across regenerations, so audit results are reproducible
- Audit is deterministic: same repository state always produces the same result

## Combining sync and audit

```bash
# Run locally before pushing
roadmapsmith sync          # update checked state based on evidence
roadmapsmith sync --audit  # verify no mismatches remain

# In CI — fails on any mismatch
roadmapsmith sync --audit
```

Run `sync` to apply evidence-backed updates. Run `sync --audit` in CI to enforce the policy without side effects.
