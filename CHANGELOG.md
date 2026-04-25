# Changelog

All notable changes to RoadmapSmith are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] — 2026-04-24

### Added
- `roadmap-sync` agent skill for skills.sh, agentskill.sh, and aitmpl.com/skills.
- CLI commands: `init`, `generate`, `sync`, `validate` with `--dry-run`, `--audit`, `--json` flags.
- Evidence-based task completion validation against repository file and symbol presence.
- Deterministic managed-block generation with phase ordering (P0 / P1 / P2) and release milestones.
- Template system for Node, Python, Go, Rust, and generic project types.
- Plugin loader for custom task matchers and validators via `roadmap-skill.config.json`.
- Full test suite covering parser, generator, validator, sync engine, and CLI integration.
- GitHub Actions CI workflow running tests and CLI smoke checks on Node 20.
