# Troubleshooting Host Setup

## Public readiness command

Use:

```bash
roadmapsmith status --json
```

`doctor --json` is compatibility-only.

## Common issues

### Node runtime missing for VS Code tasks

- install Node.js
- or set `ROADMAPSMITH_NODE` to a resolvable `node` executable
- rerun `roadmapsmith setup`

### Global shim cannot resolve Node on Windows

Ensure `node` is in PATH, or set the `ROADMAPSMITH_NODE` environment variable to the full path of your Node executable, then rerun `roadmapsmith setup`.

### Duplicate `/roadmap-sync`

This usually means a legacy `~/.agents/skills/roadmap-sync` install coexists with the full bundle or plugin.

RoadmapSmith should report that as a warning or finding, not as canonical-surface failure.

### Missing advanced VS Code tasks

Missing labels such as `Explain Workflow`, `Sync Dry Run`, or `Sync Audit` should not fail overall VS Code readiness.

### Claude hook filename

`.claude/hooks/roadmap-sync.js` is a legacy internal filename. Keep it for compatibility, but do not document it as a public command surface.
