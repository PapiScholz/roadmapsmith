# RoadmapSmith

Deterministic roadmap generation and roadmap/task synchronization for AI coding agents, with evidence-based task completion validation.

## Naming Model

- RoadmapSmith: project/product name.
- roadmap-sync: installable agent skill name.
- roadmapsmith: optional CLI package and preferred command.
- roadmap-skill/: npm package directory.

## Repository Layout

```text
roadmapsmith/
├── README.md
├── AGENTS.md
├── ROADMAP.md
├── CHANGELOG.md
├── skills.json
├── skills/
│   └── roadmap-sync/
│       └── SKILL.md
├── .claude-plugin/
│   └── plugin.json
└── roadmap-skill/
    ├── package.json
    ├── bin/
    ├── src/
    ├── templates/
    └── test/
```

## Install: Agent Skill (Primary)

### skills.sh and agentskill.sh

```bash
npx skills add PapiScholz/roadmapsmith --skill roadmap-sync
```

This adds the `roadmap-sync` agent skill. It does not install the CLI package.

### aitmpl.com/skills

Search for `roadmapsmith` on [aitmpl.com/skills](https://aitmpl.com/skills) and follow the install prompt, or install directly using the skills CLI above.

## Install: CLI (Optional)

```bash
npm install -g roadmapsmith
roadmapsmith init
roadmapsmith generate --project-root .
roadmapsmith validate --json
roadmapsmith sync --audit
```

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

## Commands

| Command | Purpose |
|---|---|
| `roadmapsmith init` | Create `ROADMAP.md` and `AGENTS.md` governance files |
| `roadmapsmith generate --project-root .` | Generate a roadmap from repository context |
| `roadmapsmith validate --json` | Validate roadmap structure |
| `roadmapsmith sync --audit` | Check completed tasks against evidence |
| `npx skills add PapiScholz/roadmapsmith --skill roadmap-sync` | Install the agent skill |

## When to use RoadmapSmith

Use RoadmapSmith when:

- You work with AI coding agents across multiple sessions
- Your project roadmap gets outdated quickly
- Agents complete tasks but forget to update documentation
- You need visible progress by phases, priorities, and releases
- You want completed checklist items backed by repository evidence

Do not use it if:

- Your project is a one-file script
- You do not use roadmaps or agent workflows
- You only need a static TODO list

## Roadmap

The canonical project roadmap and publishing checklist live in [ROADMAP.md](./ROADMAP.md).

## Warning

Do not mark roadmap tasks as completed unless repository evidence exists.
