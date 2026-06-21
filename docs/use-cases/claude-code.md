# Claude Code

Use this path when you want native Claude GUI slash commands.

## Install

```bash
npx skills add PapiScholz/roadmapsmith --skill '*' -a claude-code
```

Then reload:

1. `/reload-skills`
2. `/reload-plugins` if the host is using a plugin wrapper

## Recommended Surfaces

Canonical:

- `/roadmap`
- `/roadmap-zero`
- `/roadmap-maintain`
- `/roadmap-status`
- `/roadmap-validate`
- `/roadmap-update`
- `/roadmap-setup`

Advanced:

- `/roadmap-init`
- `/roadmap-generate`
- `/roadmap-audit`

Compatibility only:

- `/roadmap-sync <action>`
- `/road <action>`

Installing only `--skill roadmap-sync` exposes only the deprecated legacy compatibility root. It is not the recommended activation path for new workflows.

## Repo-Local Hook

`roadmapsmith setup` can generate repo-local Claude hook wiring.

The hook filename remains:

```text
.claude/hooks/roadmap-sync.js
```

That filename is a legacy internal implementation detail. It is not a public command surface and it stays unchanged for compatibility.

## Readiness

Use:

```bash
roadmapsmith status --json
```

`doctor --json` remains a compatibility alias for existing automation.
