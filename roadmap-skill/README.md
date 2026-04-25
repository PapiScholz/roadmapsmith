# roadmap-skill

Production-grade roadmap generator and sync tool for agent-driven projects.

## Install

### CLI

```bash
npm install -g roadmapsmith
```

### Agent Skill

```bash
npx skills add PapiScholz/roadmapsmith --skill roadmap-sync
```

This adds the `roadmap-sync` agent skill. It does not install the CLI package.

## Operating Modes

### Zero Mode

Agent-guided discovery for empty or low-context repositories. The developer has a product idea but no implementation files, no stack decision, and no ROADMAP.md yet.

The CLI creates governance files. The AI agent (using the `roadmap-sync` skill) performs the discovery interview before generating the roadmap.

```bash
roadmapsmith init
roadmapsmith generate --project-root .
```

### Sync/Audit Mode

Repository-backed roadmap generation, validation, and synchronization. Use when the repository already has code, tests, docs, TODOs, or an existing ROADMAP.md.

```bash
roadmapsmith generate --project-root .
roadmapsmith validate --json
roadmapsmith sync --audit
```

---

## Commands

```bash
roadmapsmith init [--roadmap-file <path>] [--agents-file <path>] [--dry-run]
roadmapsmith generate [--project-root <path>] [--config <path>] [--roadmap-file <path>] [--dry-run] [--audit]
roadmapsmith sync [--roadmap-file <path>] [--project-root <path>] [--config <path>] [--dry-run] [--audit]
roadmapsmith validate [--roadmap-file <path>] [--project-root <path>] [--config <path>] [--task <id|text>] [--json]
```

## Behavior

- Generates deterministic `ROADMAP.md` with fixed section order.
- Uses stable task IDs: `<!-- rs:task=<slug> -->`.
- Sync marks `[x]` only when validation passes.
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

  // Forward-compatible fields — recognized by the skill/agent for Zero Mode discovery context,
  // but not yet read by the generator or validator. Safe to add now; they will be wired in a future release.
  "northStar": "Ship a self-hosted CLI tool for website capture and AI-readable design analysis.",
  "targetUser": "Frontend developers, full-stack developers, and AI coding agents.",
  "problemStatement": "Developers lack a unified tool to capture screenshots, crawl pages, extract assets, and export structured context.",
  "v1Outcome": "A stable CLI that captures full-page screenshots, crawls internal links, exports metadata, and produces an AI-readable report.",
  "antiGoals": [
    "Do not bypass authentication",
    "Do not target private systems without authorization"
  ],
  "risks": [
    "Browser automation instability",
    "Scope creep into generic scraping"
  ],
  "exitCriteria": [
    "CLI works against a public test site",
    "Screenshots and metadata are exported deterministically",
    "README documents safe and authorized usage"
  ],

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
roadmapsmith init
roadmapsmith generate --project-root .
roadmapsmith validate --json
roadmapsmith sync --audit
roadmapsmith sync --dry-run
```

## Dry Run and Audit

- `--dry-run`: shows file diff preview without writing.
- `--audit`: reports roadmap/code mismatches:
  - checked without evidence
  - ready but unchecked

## Development

```bash
npm test
```

## Publishing

```bash
npm test
npm version patch   # or minor / major
npm publish --access public
git push origin main --follow-tags
```

## Versioning Strategy

- `patch`: bug fixes and non-breaking validation/generation improvements.
- `minor`: backward-compatible features (new flags, new plugin hooks, additive config fields).
- `major`: breaking CLI/config behavior or marker/format changes.
