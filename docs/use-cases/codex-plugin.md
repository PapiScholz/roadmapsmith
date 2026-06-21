# Codex Plugin

Use this path when you want native Codex discovery of the shared RoadmapSmith skill bundle.

## Install

From the repository root:

```bash
codex plugin marketplace add .
```

Then install the `roadmapsmith` plugin from the local marketplace.

## What it should expose

Canonical native slash surfaces:

- `/roadmap`
- `/roadmap-zero`
- `/roadmap-maintain`
- `/roadmap-status`
- `/roadmap-validate`
- `/roadmap-update`
- `/roadmap-setup`

Advanced native slash surfaces:

- `/roadmap-init`
- `/roadmap-generate`
- `/roadmap-audit`

## Duplicate legacy surface

If a legacy `~/.agents/skills/roadmap-sync` install is still present, Codex may show a duplicate `/roadmap-sync`.

That duplicate should be reported as a warning or finding. It must not make canonical plugin readiness unhealthy when the canonical surfaces are present.

## Validation

Use:

```bash
roadmapsmith status --json
```

to verify the Codex GUI and CLI surfaces separately from the repo-local VS Code task layer.
