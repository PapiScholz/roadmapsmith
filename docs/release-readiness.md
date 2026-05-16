# Release Readiness

## Current Status

Published as the `roadmapsmith` npm package. Release readiness is tracked here for future package and workflow changes.

## Canonical Checklist

The canonical release checklist is maintained in [ROADMAP.md](../ROADMAP.md).
Use this document for context and command runbook notes only.

## Naming and Install Intent

- Primary install path is the agent skill: `npx skills add PapiScholz/roadmapsmith --skill roadmap-sync`.
- The skill install command adds agent instructions, not the CLI package.
- The optional CLI package/command is `roadmapsmith`; update it through npm independently from the skill.

## Commands

```bash
cd roadmap-skill
npm ci
npm test
node bin/cli.js --help
node bin/cli.js init --dry-run
node bin/cli.js generate --project-root . --dry-run --audit
npm pack --dry-run
```
