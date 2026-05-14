# Changelog

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
