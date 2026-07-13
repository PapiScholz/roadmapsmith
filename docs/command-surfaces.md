# Command Surfaces

RoadmapSmith exposes three surface tiers.

## Canonical

Public default path:

- `setup`
- `zero`
- `maintain`
- `status`
- `validate`
- `update`

Behavioral contract:

- `zero`: interactive discovery when TTY is available; config-plus-flags discovery when non-interactive
- `maintain`: conservative managed-block maintenance; does not seed a managed block into a non-empty authored roadmap
- `update`: conservative inline annotation path for existing task lines, with or without a managed block

Native slash surfaces:

- `/roadmap`
- `/roadmap-zero`
- `/roadmap-maintain`
- `/roadmap-status`
- `/roadmap-validate`
- `/roadmap-update`
- `/roadmap-setup`

These are the only surfaces that count toward canonical host readiness.

## Advanced

Available, but not the default path:

- `init`
- `generate`
- `generate --full-regen`
- `sync` as the advanced alias for `update`
- `sync --audit`
- `update --concise` / `update --no-warnings`
- `verify --task <id> [--run]`

`generate` is the explicit managed-section creation path. Prefer `generate --dry-run` before applying it to an authored roadmap.

`update --task --evidence` remains part of the same canonical public `update` family.

Native slash surfaces:

- `/roadmap-init`
- `/roadmap-generate`
- `/roadmap-audit`

Missing advanced VS Code tasks or advanced native surfaces are warnings, not canonical-health failures.

## Compatibility

Legacy surfaces (`doctor`, `regenerate`, `/road`, `/roadmap-sync`, deprecated direct aliases) are documented in [legacy-commands.md](legacy-commands.md). Kept working for existing automation, they print deprecation warnings and should be shown only when explicitly invoked.
