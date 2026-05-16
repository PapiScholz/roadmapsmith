# Changelog

## v0.9.7 - 2026-05-16

### Fixed
- Validator now treats task-local `Evidence:` lines as authoritative when they reference real files or explicit passing test summaries, preventing false negatives during `sync --audit`.
- Heuristic completion is stricter for implementation tasks, blocking weak single-signal matches and explicit negative signals like `disabled` or `not implemented`.
- Parser and validator path extraction were rewritten with linear string parsing to resolve CodeQL ReDoS alerts on roadmap and evidence input handling.

## v0.9.6 - 2026-05-16

### Fixed
- `roadmapsmith sync` now scopes validation and updates to existing `rs:managed` blocks instead of allowing managed content to be structurally replaced.
- Existing managed roadmap blocks preserve custom headings, business context, task order, and task presence; sync only updates checkbox state and validation warning lines.
- Added regression coverage for weak path-only evidence so failed tasks receive a single warning without regenerating generic roadmap content.

### CI / Release
- Fixed GitHub Release note extraction to support `vX.Y.Z`, `[X.Y.Z]`, and `[vX.Y.Z]` changelog headings.
- Bumped the npm package to `0.9.6` so the release workflow publishes a new package and GitHub Release.

## v0.9.4 - 2026-05-14

### Fixed
- `grant-evidence` can now satisfy required test evidence without `overrideResult: true`.
- Validator test evidence now recognizes tests that read explicitly referenced files with `readFile` / `readFileSync`.
- Validator rules can target stable task IDs with `whenId`.
- CI validate smoke test now targets a roadmap task with current repository evidence.

### CI / Release
- Switched npm publishing back to Trusted Publishing/OIDC by using `id-token: write` and removing the static `NPM_TOKEN` publish path.

## v0.9.2 - 2026-04-29

### CI / Release
- Switched npm publish auth from OIDC Trusted Publishing to Granular Access Token with "Bypass two-factor authentication" enabled.
- Changed package Publishing access setting on npmjs.com to allow bypass-2FA tokens (required for static token CI workflows).
- Fixed empty GitHub Release notes: awk extraction now correctly picks up CHANGELOG sections.

## v0.9.1 - 2026-04-29

### CI / Release
- Workflow de GitHub Actions autopublica en npm y crea GitHub Release al detectar versión nueva en `package.json`.

## v0.9.0 - 2026-04-29

### Added
- `--version` / `-v` CLI flag: prints the installed package version and exits with code 0.

## v0.8.0 - 2026-04-28

### Added
- NANDI landing-site customer test: npm global install, project detection, web-specific task generation (SEO, OpenGraph, Lighthouse, deployment, security headers), and idempotent sync.
- Detected Project Profile section in generated ROADMAP.md for all profiles.
- `sync --audit` idempotency: 0 checked-without-evidence, 0 ready-but-unchecked on clean pass.
