# Changelog

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
