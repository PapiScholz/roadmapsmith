# Release UX Gate

Use this document before publishing a new `roadmapsmith` version.

The goal is simple: a new user must understand how to start, recover from common failures, and avoid damaging existing workspace config.

## Required User Contract

The public entrypoints must stay consistent across CLI help, VS Code tasks, launcher output, README text, and release notes:

- `roadmapsmith setup`
- `roadmapsmith zero`
- `roadmapsmith maintain`
- `roadmapsmith /road`

The optional skill remains a policy layer:

- `npx skills add PapiScholz/roadmapsmith --skill roadmap-sync`

Skill installation alone must never be described as full activation of the product.

## Pass Criteria

### 1. Fresh install, empty repo

Expected flow:

```bash
npm install -g roadmapsmith
roadmapsmith setup
roadmapsmith zero
```

Pass when:

- The user understands that `zero` is the first command for an empty repository.
- The terminal interview is clear and finite.
- `ROADMAP.md` and `AGENTS.md` are created when missing.
- The generated roadmap reflects the answers given in the interview.

### 2. Fresh install, existing repo

Expected flow:

```bash
npm install -g roadmapsmith
roadmapsmith setup
roadmapsmith maintain
```

Pass when:

- The user understands that `maintain` is the default existing-repo flow.
- The command updates the roadmap and prints the mismatch summary.
- The user is not forced to know `generate`, `sync`, and `audit` up front.

### 3. VS Code discoverability

Pass when `Tasks: Run Task` shows at least:

- `RoadmapSmith: Status`
- `RoadmapSmith: Zero Mode`
- `RoadmapSmith: Maintain`

And when `RoadmapSmith: Status` explains:

- CLI ready or missing
- Node runtime ready or missing
- tasks/config ready or missing
- skill install alone does not expose CLI behavior

### 4. Failure clarity

These cases must be tested:

- CLI missing
- Node runtime missing
- invalid `.vscode/tasks.json`
- invalid `.claude/settings.json`
- `roadmapsmith zero` in non-interactive mode
- user installed only the skill

Pass when each case tells the user:

- what is missing
- why the command cannot continue
- how to recover
- what command to run next

### 5. Config safety

Pass when:

- unrelated VS Code tasks are preserved
- unrelated Claude hooks/settings are preserved
- invalid host config causes a hard failure
- invalid host config leaves no partial writes behind

### 6. Docs and release notes

Pass when:

- `README.md` recommends `setup`, `zero`, and `maintain` first
- `roadmap-skill/README.md` matches the same contract
- `docs/release-readiness.md` matches the actual release workflow
- `roadmap-skill/CHANGELOG.md` includes the user-visible UX/runtime changes

## Evidence To Capture

For each release candidate, capture:

- terminal transcript or screenshots of the empty-repo flow
- terminal transcript or screenshots of the existing-repo flow
- screenshot of the VS Code task list
- screenshot or log of the friendly Node-runtime failure message
- result of the package test suite

## Recommended Verification Commands

```bash
cd roadmap-skill
npm ci
node --test test/*.test.js
node bin/cli.js --help
node bin/cli.js setup --project-root .. --dry-run
node bin/cli.js maintain --project-root ..
node bin/cli.js doctor --project-root .. --json
npm pack --dry-run
```

On Windows, use the absolute Node path when PATH resolution is unreliable:

```powershell
& 'C:\Program Files\nodejs\node.exe' --test roadmap-skill\test\*.test.js
```
