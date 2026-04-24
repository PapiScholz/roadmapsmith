# RoadmapSmith

Deterministic roadmap generation and roadmap/task synchronization for AI coding agents, with evidence-based task completion validation.

## Current Status

- Private/internal development
- Not published yet
- Not ready for npm or skills.sh public use

## Repository Layout

```text
roadmapsmith/
├── README.md
├── AGENTS.md
├── ROADMAP.md
└── roadmap-skill/
    ├── package.json
    ├── bin/
    ├── src/
    ├── test/
    ├── skills.json
    └── skills/roadmap-sync/
```

## Monorepo-Style Package Layout

This repository currently uses a monorepo-style layout where the npm package lives in `roadmap-skill/`. Run npm/package commands from that directory.

## Local Development

```bash
cd roadmap-skill
npm install
npm test
node bin/cli.js --help
node bin/cli.js init --dry-run
node bin/cli.js generate --project-root . --dry-run --audit
node bin/cli.js validate --json
```

## Future Install Examples (Not Available Yet)

```bash
npm install -g roadmapsmith
npx skills add PapiScholz/roadmapsmith --skill roadmap-sync
```

## Roadmap

The canonical project roadmap and publishing checklist live in [ROADMAP.md](./ROADMAP.md).

## Warning

Do not mark roadmap tasks as completed unless repository evidence exists.
