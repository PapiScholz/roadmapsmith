# Legacy Commands

Compatibility-only surfaces kept alive for existing automation. New users should reach for the canonical commands documented in [`command-surfaces.md`](command-surfaces.md); anything below prints a deprecation warning and may be removed in a future major.

## Canonical replacements

| Legacy                        | Canonical                                        |
|-------------------------------|--------------------------------------------------|
| `roadmapsmith doctor`         | `roadmapsmith status`                            |
| `roadmapsmith regenerate`     | removed — use `roadmapsmith generate --full-regen` |
| `roadmapsmith maintain`       | `roadmapsmith update --apply` (deprecated in v0.13.0) |
| `/road <action>`              | `/roadmap`                                       |
| `/roadmap-sync <action>`      | `/roadmap-update`                                |

`regenerate` was documented as compat but never routed through `bin/cli.js`. Prefer `generate --full-regen` if you need the destructive rebuild path.

`maintain` still works in v0.13.0 but prints `WARNING: 'maintain' is deprecated. Use 'update --apply'.` on every invocation.

## CLI

- `roadmapsmith doctor`
- `roadmapsmith regenerate`
- `roadmapsmith /road <action>`
- `roadmapsmith /roadmap-sync <action>`
- deprecated direct aliases such as `/maintain` or `/status`

## Slash surfaces

- `/roadmap-sync <action>`
- `/road <action>`
- deprecated direct aliases

Native-bundle readiness is computed from canonical surfaces only. Missing advanced labels or duplicate legacy `/roadmap-sync` installs are warnings, not canonical-health failures.

## Deprecated markers (v0.13.0)

`rs:evidence=manual` and `rs:no-test` were removed in v0.13.0. Running `roadmapsmith update` against a roadmap that still contains them throws a `Deprecated marker …` error. Run `roadmapsmith migrate-markers` to convert `rs:evidence=manual` → `rs:kind=manual` and drop `rs:no-test`.
