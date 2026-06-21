<p align="center">
  <img src="https://raw.githubusercontent.com/PapiScholz/roadmapsmith/main/assets/roadmapsmith-logo.png" alt="RoadmapSmith logo" width="180">
</p>

<h1 align="center">RoadmapSmith</h1>

Evidence-backed roadmap workflows for AI coding agents.

## Install

### CLI

```bash
npm install -g roadmapsmith
roadmapsmith setup
```

### Claude Code bundle

```bash
npx skills add PapiScholz/roadmapsmith --skill '*' -a claude-code
```

This installs the native Claude GUI slash bundle. It does not install the CLI.

## Quick Start

Empty or low-context repository:

```bash
roadmapsmith zero
```

Existing repository:

```bash
roadmapsmith maintain
```

Readiness and host setup:

```bash
roadmapsmith status --json
```

Complete one task with verified evidence:

```bash
roadmapsmith update --task <stable-id> --evidence "src/file.ts, test/file.test.ts"
```

## Daily Flow

1. Run `roadmapsmith setup` when you want the VS Code task layer and optional Claude hook template.
2. Use `roadmapsmith zero` for empty repos.
3. Use `roadmapsmith maintain` for existing repos.
4. Use `roadmapsmith status` as the public readiness command.

## Command Surfaces

Canonical public surfaces:

- `setup`
- `zero`
- `maintain`
- `status`
- `validate`
- `update`

`update` is the public family for both evidence-backed checklist refresh and verified single-task completion. Advanced surfaces such as `init`, `generate`, `generate --full-regen`, `sync`, and `sync --audit` remain available, but they are documented separately in [docs/command-surfaces.md](docs/command-surfaces.md).

Compatibility-only surfaces such as `doctor`, `regenerate`, `/road <action>`, and `/roadmap-sync <action>` remain executable for existing automation but are no longer part of the primary UX.

## Verification Model

Unchecked implementation tasks do not complete from file existence, token overlap, or test-file presence alone.

Completion comes from:

- explicit `Evidence:`
- typed `Verify:` metadata
- fresh behavioral test proof when `Verify: kind=behavior` is used

For independent auditing, prefer:

```bash
roadmapsmith maintain
roadmapsmith validate --strict --json
```

`sync --audit` remains an advanced mutating summary, not an independent audit engine.

## Docs

- [roadmap-skill/README.md](roadmap-skill/README.md): CLI and package contract
- [docs/command-surfaces.md](docs/command-surfaces.md): canonical, advanced, and compatibility taxonomy
- [docs/troubleshooting-host-setup.md](docs/troubleshooting-host-setup.md): host setup and runtime troubleshooting
- [docs/use-cases/claude-code.md](docs/use-cases/claude-code.md): Claude-specific install and hook behavior
- [docs/use-cases/codex-plugin.md](docs/use-cases/codex-plugin.md): Codex plugin install and duplicate-surface troubleshooting
- [docs/use-cases/sync-audit-mode.md](docs/use-cases/sync-audit-mode.md): maintain, sync, audit, and strict validation semantics
- [docs/release-readiness.md](docs/release-readiness.md): maintainer and release workflow
