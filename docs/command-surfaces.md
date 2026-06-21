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

`update --task --evidence` remains part of the same canonical public `update` family.

Native slash surfaces:

- `/roadmap-init`
- `/roadmap-generate`
- `/roadmap-audit`

Missing advanced VS Code tasks or advanced native surfaces are warnings, not canonical-health failures.

## Compatibility

Kept working for existing automation:

- `doctor`
- `regenerate`
- `/road <action>`
- `/roadmap-sync <action>`
- deprecated direct aliases

Compatibility surfaces should be shown only when explicitly invoked or when the user searches for them.
