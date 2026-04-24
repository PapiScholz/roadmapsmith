# Release Readiness

## Current Status

Private/internal development. Not published.

## Canonical Checklist

The canonical release checklist is maintained in [ROADMAP.md](../ROADMAP.md).
Use this document for context and command runbook notes only.

## Commands

```bash
cd roadmap-skill
npm ci
npm test
node bin/cli.js --help
node bin/cli.js init --dry-run
node bin/cli.js generate --project-root . --dry-run --audit
```

Do not mark public-release tasks as complete yet.
