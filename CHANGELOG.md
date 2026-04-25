# Changelog

All notable changes to RoadmapSmith are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Two-mode product model: Zero Mode (empty repo discovery) and Sync/Audit Mode (existing repo validation).
- Zero Mode documentation: discovery interview contract, 8 discovery questions, north star definition flow.
- Sync/Audit Mode explicitly documented as the existing repository-backed validation workflow — not deprecated.
- Updated product north star in ROADMAP.md to reflect two-mode operating system.
- Updated skill instructions (SKILL.md) with mode selection rules and Zero Mode guardrails.
- Updated AGENTS.md with RoadmapSmith Mode Rule for agent decision-making.
- Use-case docs: `docs/use-cases/zero-mode-discovery.md` and `docs/use-cases/sync-audit-mode.md`.
- Forward-compatible discovery config fields (`northStar`, `targetUser`, `problemStatement`, `v1Outcome`, `antiGoals`, `risks`, `exitCriteria`) documented in `roadmap-skill.config.json` example (recognized by the agent; generator wiring planned for a future release).

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
