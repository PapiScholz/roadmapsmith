# roadmap-skill

Production-grade roadmap generator and sync tool for agent-driven projects.

## Install Status

This package and skill are in private/internal development. Public install flows are not available yet.

### Future CLI package install (not available yet)

```bash
npm install -g roadmapsmith
```

### Local development usage

```bash
npx roadmap-skill <command>
```

### Future skill install (`npx skills add`, not available yet)

```bash
npx skills add PapiScholz/roadmapsmith --skill roadmap-sync
```

## Commands

```bash
roadmap-skill init [--roadmap-file <path>] [--agents-file <path>] [--dry-run]
roadmap-skill generate [--project-root <path>] [--config <path>] [--roadmap-file <path>] [--dry-run] [--audit]
roadmap-skill sync [--roadmap-file <path>] [--project-root <path>] [--config <path>] [--dry-run] [--audit]
roadmap-skill validate [--roadmap-file <path>] [--project-root <path>] [--config <path>] [--task <id|text>] [--json]
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
roadmap-skill init
roadmap-skill generate --project-root .
roadmap-skill validate --json
roadmap-skill sync --audit
roadmap-skill sync --dry-run
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

## Publishing (Future, Not Yet)

### npm (public package, future)

1. Run tests.

```bash
npm test
```

2. Bump version using semver.

```bash
npm version patch
# or: npm version minor
# or: npm version major
```

3. Publish package.

```bash
npm publish --access public
```

4. Push tags.

```bash
git push origin main --follow-tags
```

### skills.sh / `npx skills add` discoverability (future)

1. After internal release-readiness is complete, make the repository public with `skills/roadmap-sync/SKILL.md` and `skills.json`.
2. Verify install flow from a clean project:

```bash
npx skills add PapiScholz/roadmapsmith --skill roadmap-sync
```

3. Confirm the installed skill appears in your agent skill list.

## Versioning Strategy

- `patch`: bug fixes and non-breaking validation/generation improvements.
- `minor`: backward-compatible features (new flags, new plugin hooks, additive config fields).
- `major`: breaking CLI/config behavior or marker/format changes.
