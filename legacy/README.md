# Legacy — roadmapsmith v0.x (pre-v1.0)

This directory holds the pre-v1.0 code. It shipped a CLI (`roadmap-skill/`), a validator, an audit engine, a demo pipeline, and marketing assets. It works but is no longer the recommended path — it is preserved here for reference and to keep git history intact.

The current tool is the self-contained Claude Code skill in [`../plugins/roadmapsmith/skills/`](../plugins/roadmapsmith/skills/), installable via:

    npx github:PapiScholz/roadmapsmith

Nothing in this directory receives active development.

## Contents

- `roadmap-skill/` — the CLI package (v0.15.x). Node.js, 312 tests, validator + audit engine + drift detection.
- `docs/` — historical planning docs, use cases, audit remediation.
- `scripts/` — demo scripts (`false-claim-repro.sh`, A/B demo).
- `assets/` — demo GIFs and logos used by the pre-v1.0 README.
- `roadmap-skill.config.json` — CLI config schema example.
- `skills.json` — `npx skills add` manifest for the pre-v1.0 skill bundle.
