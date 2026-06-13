<p align="center">
  <img src="https://raw.githubusercontent.com/PapiScholz/roadmapsmith/main/assets/roadmapsmith-logo.png" alt="RoadmapSmith logo" width="180">
</p>

<h1 align="center">RoadmapSmith</h1>

Production-grade roadmap generator and sync tool for agent-driven projects.

## Install

### CLI

```bash
npm install -g roadmapsmith
roadmapsmith setup
roadmapsmith zero
roadmapsmith maintain
```

Slash entrypoints are also supported from the CLI and launcher, for example: `roadmapsmith /road`, `roadmapsmith /zero`, `roadmapsmith /maintain`, and `roadmapsmith /roadmap-sync maintain`.
The generated VS Code task layer now resolves Node automatically where possible; if it cannot, RoadmapSmith prints a readable runtime diagnostic instead of a dead task.
`RoadmapSmith: Status` now treats "ready" as runnable task UX, not merely generated files.

### Agent Skill

```bash
npx skills add PapiScholz/roadmapsmith --skill '*' -a claude-code
```

This is the recommended Claude Code install path for native GUI slash commands such as `/road`, `/zero`, `/maintain`, `/status`, `/init`, `/generate`, `/validate`, `/sync`, `/audit`, `/setup`, and the legacy `/roadmap-sync`.
If you install only `--skill roadmap-sync`, Claude GUI will expose only `/roadmap-sync`.
The skill bundle does not install the CLI and it does not create visible VS Code actions by itself.

## Updating

Update the CLI based on how it was installed:

```bash
# Global npm install
npm install -g roadmapsmith@latest

# Project dependency
npm install roadmapsmith@latest

# One-off execution without installing
npx roadmapsmith@latest validate --json
```

The Claude skill bundle is separate from the CLI. Re-running the skills install updates the Claude-facing instructions, but it does not update the `roadmapsmith` npm binary or the generated VS Code host files:

```bash
npx skills add PapiScholz/roadmapsmith --skill '*' -a claude-code
```

After updating the Claude skill bundle, run `/reload-skills` and, if applicable, `/reload-plugins`.
After updating the CLI, rerun `roadmapsmith setup` in repositories where you want the latest VS Code tasks, task wrappers, launcher behavior, or Claude hook template.

Fixes are available through `@latest` only after a new npm package version has been published. Before publication, install from a local checkout or a packed tarball for testing.

## Operating Modes

### Zero Mode

Agent-guided discovery for empty or low-context repositories. The developer has a product idea but no implementation files, no stack decision, and no ROADMAP.md yet.

Run `roadmapsmith setup` first if you want visible VS Code tasks. `roadmapsmith zero` is the one-command entrypoint: it runs the terminal interview, creates governance files when needed, and generates the first roadmap.

```bash
roadmapsmith setup
roadmapsmith zero
```

### Sync/Audit Mode

Repository-backed roadmap generation, validation, and synchronization. Use when the repository already has code, tests, docs, TODOs, or an existing ROADMAP.md.

```bash
roadmapsmith setup
roadmapsmith maintain
```

## Recommended Daily Flow

Use the public entrypoints first:

```bash
roadmapsmith setup
roadmapsmith zero       # empty repo
roadmapsmith maintain   # existing repo
```

Use the lower-level commands only when you want manual control over generation, validation, or sync.

## Host Support Today

| Host | Current support |
|---|---|
| Claude Code | Supported through the full RoadmapSmith skill bundle for native GUI slash commands, plus `roadmapsmith setup` for visible VS Code tasks and the optional repo-local Claude hook. |
| Codex / Codex CLI | Supported through a visible VS Code task workflow and slash-capable launcher UX after `roadmapsmith setup`. Codex chat itself remains unchanged unless the host exposes native slash registration. |
| CI | Use disposable checkouts if you run `sync --audit`, because it still mutates the roadmap today. |
| Other hosts | Use the skill plus manual CLI commands. |

If Node is installed outside PATH, set `ROADMAPSMITH_NODE` to a working `node` executable before using the generated VS Code tasks.

---

## Commands

```bash
roadmapsmith /road
roadmapsmith /zero
roadmapsmith /maintain
roadmapsmith /roadmap-sync maintain
roadmapsmith setup [--project-root <path>] [--config <path>] [--editor vscode] [--hosts <codex,claude>] [--dry-run]
roadmapsmith zero [--project-root <path>] [--config <path>]
roadmapsmith maintain [--project-root <path>] [--config <path>] [--roadmap-file <path>]
roadmapsmith init [--roadmap-file <path>] [--agents-file <path>] [--dry-run]
roadmapsmith generate [--project-root <path>] [--config <path>] [--roadmap-file <path>] [--dry-run] [--audit]
roadmapsmith sync [--roadmap-file <path>] [--project-root <path>] [--config <path>] [--dry-run] [--audit]
roadmapsmith validate [--roadmap-file <path>] [--project-root <path>] [--config <path>] [--task <id|text>] [--json]
roadmapsmith doctor [--roadmap-file <path>] [--project-root <path>] [--config <path>] [--json]
```

## Claude Code native slash commands

Install the full skill bundle for Claude Code:

```bash
npx skills add PapiScholz/roadmapsmith --skill '*' -a claude-code
```

Then reload the session:

1. Run `/reload-skills`
2. If RoadmapSmith was installed through a Claude plugin, also run `/reload-plugins`
3. Confirm the slash menu shows `/road`, `/zero`, `/maintain`, `/status`, `/init`, `/generate`, `/validate`, `/sync`, `/audit`, `/setup`, and `/roadmap-sync`

Native Claude GUI slash commands come from the installed skill bundle. CLI slash routing such as `roadmapsmith /road` is a separate surface and does not populate the Claude GUI menu by itself.

## Behavior

- Generates deterministic `ROADMAP.md` with fixed section order.
- Uses stable task IDs: `<!-- rs:task=<slug> -->`.
- Sync marks `[x]` only when validation passes.
- `sync --audit` currently runs sync and then prints a mismatch summary; it is not yet a dedicated read-only audit mode.
- Validation evidence gate:
  - code OR test OR artifact evidence required.
  - test evidence required for code tasks when test frameworks are detected.
- Validation failures in sync write warning lines:
  - `- ⚠️ attempted but validation failed: <reason>`
- Preserves unmanaged markdown content by updating only the managed roadmap block.

## Defaults

- Roadmap file: `./ROADMAP.md` (falls back to `./roadmap.md` when only the legacy file exists)
- Agent rules file: `./AGENTS.md` (falls back to `./CLAUDE.md` when present)
- Config file: `./roadmap-skill.config.json`

Roadmap resolution precedence:

1. `--roadmap-file` CLI flag
2. `config.roadmapFile` in `roadmap-skill.config.json`
3. Existing `./ROADMAP.md`
4. Existing `./roadmap.md` (legacy fallback)
5. `./ROADMAP.md` when neither file exists

## Config

Create `roadmap-skill.config.json`:

```json
{
  "roadmapFile": "./ROADMAP.md",
  "agentsFile": "./AGENTS.md",
  "roadmapProfile": "professional",
  "product": {
    "name": "My Project",
    "northStar": "Ship a self-hosted CLI tool for website capture and AI-readable design analysis.",
    "positioning": "What makes this different from alternatives.",
    "primaryUser": "Frontend developers, full-stack developers, and AI coding agents.",
    "targetOutcome": "A stable CLI that captures full-page screenshots, crawls internal links, exports metadata, and produces an AI-readable report.",
    "antiGoals": [
      "Do not bypass authentication",
      "Do not target private systems without authorization"
    ],
    "risks": [
      "Browser automation instability",
      "Scope creep into generic scraping"
    ],
    "successCriteria": [
      "CLI works against a public test site",
      "Screenshots and metadata are exported deterministically",
      "README documents safe and authorized usage"
    ]
  },

  "taskMatchers": [
    {
      "pattern": "src/payments/",
      "task": "Complete payment flow hardening",
      "phase": "P0",
      "priority": "P0"
    }
  ],
  "validators": [
    {
      "type": "file-exists",
      "when": "migration",
      "path": "db/migrations"
    },
    {
      "type": "grant-evidence",
      "whenId": "^p0-electron-builder-windows$",
      "evidence": ["test"],
      "testFiles": ["test/electron-builder.test.js"]
    }
  ],
  "customSections": [
    {
      "title": "Compliance",
      "items": [
        "- [ ] Complete SOC2 evidence packet <!-- rs:task=compliance-soc2-evidence -->"
      ]
    }
  ],
  "plugins": [
    "./plugins/roadmap.plugin.js"
  ],
  "milestones": [
    { "version": "v0.1", "goal": "Foundation" },
    { "version": "v0.2", "goal": "Reliability" },
    { "version": "v0.3", "goal": "Release candidate" },
    { "version": "v1.0", "goal": "General availability" }
  ],
  "phaseTemplates": {
    "P0": ["Stabilize critical path"],
    "P1": ["Expand reliability"],
    "P2": ["Finalize release hardening"]
  }
}
```

Task markers can include `rs:no-test` to disable the test-evidence requirement for one task:

```markdown
- [ ] Add Windows autostart script <!-- rs:task=p0-windows-autostart rs:no-test -->
```

Validator rules are backward compatible:

- `when` matches task text.
- `whenId` matches the stable `rs:task` ID.
- `grant-evidence` can grant `code`, `test`, or `artifact` evidence without `overrideResult`.
- `overrideResult: true` is only needed when a rule should replace automatic failures.
- Tests that read a referenced file with `fs.readFileSync`, `fs.readFile`, `readFileSync`, or `readFile` can count as test evidence for tasks that explicitly mention that file.

## Plugin API

Plugin module path(s) are loaded from `config.plugins` in deterministic order.

```js
module.exports = {
  registerTaskDetectors(ctx) {
    return [
      { text: 'Implement billing retries', phase: 'P1', priority: 'P1' }
    ];
  },
  registerSectionGenerators(ctx) {
    return [
      {
        title: 'Platform Notes',
        items: ['- [ ] Verify deployment rollback path <!-- rs:task=verify-deployment-rollback-path -->']
      }
    ];
  },
  registerValidators(ctx) {
    return [
      {
        type: 'symbol',
        when: 'billing',
        pattern: 'retry',
        message: 'billing retry symbol not found'
      }
    ];
  }
};
```

## Example Usage

```bash
roadmapsmith zero
roadmapsmith maintain
roadmapsmith validate --json
roadmapsmith sync --dry-run
```

## Dry Run and Audit

- `--dry-run`: shows file diff preview without writing.
- `--audit`: currently runs sync and then reports roadmap/code mismatches:
  - checked without evidence
  - ready but unchecked

## Development

```bash
npm test
```

If `npm test` fails in your shell with "`node` is not recognized", treat that as a local PATH/runtime issue first and rerun the suite with an explicit Node executable.

## Publishing

```bash
npm test
npm version patch   # or minor / major
npm publish --access public
git push origin main --follow-tags
```

Repository-specific release note:

- The canonical release automation lives in `.github/workflows/ci.yml`.
- This repository publishes from GitHub Actions on `main`; local `npm publish` is a maintainer workflow, not the default repo release path.
- Before publishing, verify the UX/release gate in `docs/release-ux-gate.md` and update `CHANGELOG.md` with the user-visible behavior changes.

## Versioning Strategy

- `patch`: bug fixes and non-breaking validation/generation improvements.
- `minor`: backward-compatible features (new flags, new plugin hooks, additive config fields).
- `major`: breaking CLI/config behavior or marker/format changes.
