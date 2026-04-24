# Contributing

Thanks for your interest in contributing to RoadmapSmith.

This repository is currently in private/internal development, but contributions from invited collaborators are welcome.

## Before You Start

- Read [README.md](./README.md) and [AGENTS.md](./AGENTS.md).
- Keep changes focused and scoped to a single purpose.
- Avoid unrelated refactors in the same PR.

## Local Development

The package lives in `roadmap-skill/`.

```bash
cd roadmap-skill
npm install
npm test
node bin/cli.js --help
```

Recommended validation commands:

```bash
node bin/cli.js init --dry-run
node bin/cli.js generate --project-root . --dry-run --audit
node bin/cli.js validate --json
```

## Branches and Commits

- Create a feature branch from `main`.
- Use clear commit messages describing intent and scope.
- Keep commits logically grouped and reviewable.

## Pull Requests

Include the following in your PR description:

- What changed and why.
- Any behavior or CLI output changes.
- Test coverage for new behavior.
- Known limitations or follow-up tasks.

PRs should pass tests before review.

## Testing Guidance

- Add or update tests for behavior changes.
- Preserve deterministic roadmap behavior.
- Keep test discovery scoped to `test/*.test.js` and avoid executing files in `test/fixtures`.

## Security

If you discover a vulnerability, follow [SECURITY.md](./SECURITY.md) and avoid public disclosure until maintainers confirm remediation.

## Code of Conduct

By participating, you agree to follow [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).
