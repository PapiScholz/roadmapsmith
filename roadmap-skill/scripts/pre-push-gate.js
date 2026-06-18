'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..');
const CLI_PATH = path.join(PACKAGE_ROOT, 'bin', 'cli.js');
const LAUNCHER_PATH = path.join(REPO_ROOT, '.vscode', 'roadmapsmith-launcher.js');
const TEST_RUNNER_PATH = path.join(PACKAGE_ROOT, 'scripts', 'run-tests.js');
const ELECTRON_FIXTURE_ROOT = path.join(PACKAGE_ROOT, 'test', 'fixtures', 'electron-pos');
const ELECTRON_FIXTURE_ROADMAP = path.join(ELECTRON_FIXTURE_ROOT, 'ROADMAP.md');
const GATE_PROFILE = 'Amplio';

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function stringifyCommand(command, args) {
  return [command, ...(args || [])]
    .map((part) => {
      const text = String(part);
      return /\s/.test(text) ? JSON.stringify(text) : text;
    })
    .join(' ');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getErrorMessage(error) {
  if (!error) {
    return 'Unknown gate failure.';
  }
  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }
  return String(error);
}

function parseArgv(argv) {
  const args = Array.isArray(argv) ? argv.slice() : [];
  const flags = new Set();
  const positionals = [];

  for (const arg of args) {
    if (arg === '--json' || arg === '--plan') {
      flags.add(arg);
      continue;
    }
    positionals.push(arg);
  }

  return {
    mode: positionals[0] || 'all',
    json: flags.has('--json'),
    planOnly: flags.has('--plan')
  };
}

function buildQaRegressionChecks(nodePath = process.execPath) {
  return [
    {
      id: 'full-test-suite',
      label: 'Full roadmap-skill test suite',
      command: nodePath,
      args: [TEST_RUNNER_PATH],
      cwd: PACKAGE_ROOT,
      covers: ['CLI contract', 'slash surface', 'bundle manifests', 'launcher/task surface', 'docs contract tests'],
      validate(result) {
        assert(result.status === 0, 'Full test suite must exit 0.');
        assert(/fail 0/i.test(result.stdout), 'Full test suite must report zero failures.');
      }
    },
    {
      id: 'packed-surface',
      label: 'Packed npm/plugin bundle surface',
      command: nodePath,
      args: ['scripts/verify-pack-surface.js'],
      cwd: PACKAGE_ROOT,
      covers: ['skills.json', '.claude-plugin/plugin.json', '.codex-plugin/plugin.json', 'packed artifact skill surface'],
      validate(result) {
        assert(result.status === 0, 'Packed surface verification must exit 0.');
        assert(/Verified packed npm artifact surface/i.test(result.stdout), 'Packed surface verification must confirm artifact validation.');
      }
    }
  ];
}

function buildFunctionalSmokeChecks(nodePath = process.execPath) {
  return [
    {
      id: 'maintain-dry-run-electron',
      label: 'Maintain preserve-mode dry-run on Electron fixture',
      command: nodePath,
      args: [CLI_PATH, 'maintain', '--project-root', ELECTRON_FIXTURE_ROOT, '--dry-run'],
      cwd: PACKAGE_ROOT,
      covers: ['maintain default flow', 'Electron classifier', 'preserve-mode default'],
      prepare() {
        return { roadmapBefore: readText(ELECTRON_FIXTURE_ROADMAP) };
      },
      validate(result, context) {
        assert(result.status === 0, 'maintain --dry-run must exit 0 on the Electron fixture.');
        assert(/Dry run:/i.test(result.stdout), 'maintain --dry-run must print a diff preview.');
        assert(/Audit summary:/i.test(result.stdout), 'maintain --dry-run must still run sync/audit.');
        assert(!/Add SEO metadata|Lighthouse performance score/i.test(result.stdout), 'Electron fixture smoke must not surface web-only tasks.');
        assert(readText(ELECTRON_FIXTURE_ROADMAP) === context.roadmapBefore, 'maintain --dry-run must not mutate the Electron fixture roadmap.');
      }
    },
    {
      id: 'doctor-json',
      label: 'Doctor JSON smoke on repo root',
      command: nodePath,
      args: [CLI_PATH, 'doctor', '--project-root', REPO_ROOT, '--json'],
      cwd: PACKAGE_ROOT,
      covers: ['doctor output', 'host/bundle readiness surface', 'VS Code launcher/tasks'],
      validate(result) {
        assert(result.status === 0, 'doctor --json must exit 0 for the repo root gate.');
        const payload = JSON.parse(result.stdout);
        assert(payload && payload.surfaces, 'doctor --json must return native surface data.');
        const surfaceKeys = Object.keys(payload.surfaces).sort();
        assert(JSON.stringify(surfaceKeys) === JSON.stringify(['claudeCli', 'claudeGui', 'codexCli', 'codexGui']), 'doctor --json must report all four native surfaces.');
      }
    },
    {
      id: 'direct-slash-update-dry-run',
      label: 'Direct /roadmap-update dry-run smoke',
      command: nodePath,
      args: [CLI_PATH, '/roadmap-update', '--project-root', ELECTRON_FIXTURE_ROOT, '--dry-run'],
      cwd: PACKAGE_ROOT,
      covers: ['/roadmap-update', 'sync dry-run', 'namespaced slash execution'],
      prepare() {
        return { roadmapBefore: readText(ELECTRON_FIXTURE_ROADMAP) };
      },
      validate(result, context) {
        assert(result.status === 0, '/roadmap-update --dry-run must exit 0.');
        assert(/No changes for|Dry run:/i.test(result.stdout), '/roadmap-update --dry-run must behave like sync dry-run.');
        assert(readText(ELECTRON_FIXTURE_ROADMAP) === context.roadmapBefore, '/roadmap-update --dry-run must not mutate the Electron fixture roadmap.');
      }
    },
    {
      id: 'generate-refuses-without-full-regen',
      label: 'Generate refuses substantive block replacement without --full-regen',
      command: nodePath,
      args: [CLI_PATH, 'generate', '--project-root', ELECTRON_FIXTURE_ROOT],
      cwd: PACKAGE_ROOT,
      expectedExitCodes: [1],
      covers: ['generate refusal path', 'managed-block safety'],
      prepare() {
        return { roadmapBefore: readText(ELECTRON_FIXTURE_ROADMAP) };
      },
      validate(result, context) {
        assert(/--full-regen/i.test(result.stderr), 'generate refusal smoke must instruct the caller to rerun with --full-regen.');
        assert(readText(ELECTRON_FIXTURE_ROADMAP) === context.roadmapBefore, 'generate refusal must not mutate the Electron fixture roadmap.');
      }
    },
    {
      id: 'generate-full-regen-dry-run',
      label: 'Generate full-regen dry-run keeps destructive path explicit',
      command: nodePath,
      args: [CLI_PATH, 'generate', '--project-root', ELECTRON_FIXTURE_ROOT, '--dry-run', '--full-regen'],
      cwd: PACKAGE_ROOT,
      covers: ['--full-regen explicit path', 'full regeneration preview'],
      prepare() {
        return { roadmapBefore: readText(ELECTRON_FIXTURE_ROADMAP) };
      },
      validate(result, context) {
        assert(result.status === 0, 'generate --full-regen --dry-run must exit 0.');
        assert(/Dry run:/i.test(result.stdout), 'generate --full-regen --dry-run must print a diff preview.');
        assert(/Phase P0 \(Critical\)|## 1\. Product North Star/i.test(result.stdout), 'generate --full-regen --dry-run must preview regenerated roadmap content.');
        assert(readText(ELECTRON_FIXTURE_ROADMAP) === context.roadmapBefore, 'generate --full-regen --dry-run must not mutate the Electron fixture roadmap.');
      }
    },
    {
      id: 'launcher-palette',
      label: 'VS Code launcher palette smoke',
      command: nodePath,
      args: [LAUNCHER_PATH, '/roadmap'],
      cwd: REPO_ROOT,
      covers: ['VS Code launcher', '/roadmap palette', '/roadmap-update discoverability'],
      validate(result) {
        assert(result.status === 0, 'Launcher /roadmap palette smoke must exit 0.');
        assert(/RoadmapSmith slash palette/i.test(result.stdout), 'Launcher smoke must print the RoadmapSmith palette.');
        assert(/\/roadmap-update/i.test(result.stdout), 'Launcher palette smoke must expose /roadmap-update.');
      }
    },
    {
      id: 'legacy-router-validate',
      label: 'Legacy /roadmap-sync <action> smoke',
      command: nodePath,
      args: [CLI_PATH, '/roadmap-sync', 'validate', '--json', '--project-root', ELECTRON_FIXTURE_ROOT],
      cwd: PACKAGE_ROOT,
      expectedExitCodes: [0, 1],
      covers: ['legacy /roadmap-sync <action>', 'validate routing', 'deprecation warning'],
      validate(result) {
        assert(/deprecated/i.test(result.stderr), 'Legacy /roadmap-sync validate smoke must emit the deprecation warning.');
        const payload = JSON.parse(result.stdout);
        assert(Array.isArray(payload), 'Legacy /roadmap-sync validate smoke must still return JSON validation output.');
      }
    }
  ];
}

function getGateDefinition(mode, nodePath = process.execPath) {
  if (mode === 'qa-regression') {
    return {
      gate: 'qa-regression',
      profile: GATE_PROFILE,
      summary: 'Runs the full roadmap-skill regression suite and packed surface verification.',
      residualRisks: [
        'Does not prove interactive Zero Mode UX with a human in the loop.',
        'Does not prove real external Claude/Codex host registration on this machine.'
      ],
      unvalidatedSurfaces: [
        'Real Claude GUI slash menu rendering',
        'Real Codex marketplace install interaction'
      ],
      checks: buildQaRegressionChecks(nodePath)
    };
  }

  if (mode === 'functional-smoke') {
    return {
      gate: 'functional-smoke',
      profile: GATE_PROFILE,
      summary: 'Runs CLI and host smoke flows that protect preserve-mode, explicit full regen, slash routing, and launcher behavior.',
      residualRisks: [
        'Does not execute a real push/publish workflow.',
        'Does not cover interactive human-facing screenshots or UI recordings.'
      ],
      unvalidatedSurfaces: [
        'GitHub branch protection / push pipeline behavior',
        'Manual VS Code task list rendering'
      ],
      checks: buildFunctionalSmokeChecks(nodePath)
    };
  }

  if (mode === 'all') {
    return {
      gate: 'pre-push',
      profile: GATE_PROFILE,
      summary: 'Aggregates the QA/Regression and Functional/Smoke gates required before any push.',
      subgates: [
        getGateDefinition('qa-regression', nodePath),
        getGateDefinition('functional-smoke', nodePath)
      ]
    };
  }

  throw new Error(`Unsupported gate mode "${mode}". Use qa-regression, functional-smoke, or all.`);
}

function buildCheckResult(check, result, status, errorMessage) {
  return {
    id: check.id,
    label: check.label,
    status,
    exitCode: typeof result?.status === 'number' ? result.status : null,
    cwd: check.cwd,
    command: stringifyCommand(check.command, check.args),
    covers: check.covers || [],
    ...(errorMessage ? { error: errorMessage } : {})
  };
}

function executeCheck(check) {
  let result = null;

  try {
    const beforeContext = typeof check.prepare === 'function' ? check.prepare() : {};
    result = spawnSync(check.command, check.args, {
      cwd: check.cwd,
      encoding: 'utf8'
    });

    if (result.error) {
      throw result.error;
    }

    const expectedExitCodes = Array.isArray(check.expectedExitCodes) ? check.expectedExitCodes : [0];
    assert(expectedExitCodes.includes(result.status), `${check.id} exited with ${result.status}; expected ${expectedExitCodes.join(', ')}.`);
    if (typeof check.validate === 'function') {
      check.validate(result, beforeContext);
    }

    return buildCheckResult(check, result, 'pass');
  } catch (error) {
    return buildCheckResult(check, result, 'fail', getErrorMessage(error));
  }
}

function runGateDefinition(definition, options = {}) {
  if (definition.subgates) {
    const subgates = definition.subgates.map((subgate) => runGateDefinition(subgate, options));
    const status = subgates.every((subgate) => subgate.status === 'pass') ? 'pass' : 'fail';
    return {
      gate: definition.gate,
      profile: definition.profile,
      summary: definition.summary,
      status,
      subgates
    };
  }

  if (options.planOnly) {
    return {
      gate: definition.gate,
      profile: definition.profile,
      summary: definition.summary,
      status: 'planned',
      residualRisks: definition.residualRisks.slice(),
      unvalidatedSurfaces: definition.unvalidatedSurfaces.slice(),
      checks: definition.checks.map((check) => ({
        id: check.id,
        label: check.label,
        cwd: check.cwd,
        command: stringifyCommand(check.command, check.args),
        covers: check.covers || [],
        expectedExitCodes: Array.isArray(check.expectedExitCodes) ? check.expectedExitCodes : [0]
      }))
    };
  }

  const checks = definition.checks.map(executeCheck);
  const status = checks.every((check) => check.status === 'pass') ? 'pass' : 'fail';
  return {
    gate: definition.gate,
    profile: definition.profile,
    summary: definition.summary,
    status,
    residualRisks: definition.residualRisks.slice(),
    unvalidatedSurfaces: definition.unvalidatedSurfaces.slice(),
    checks
  };
}

function renderReport(report) {
  const lines = [];

  if (report.subgates) {
    lines.push(`Pre-push validation gate [${report.status.toUpperCase()}]`);
    lines.push(`Profile: ${report.profile}`);
    lines.push(report.summary);
    lines.push('');
    report.subgates.forEach((subgate) => {
      lines.push(...renderReport(subgate).split('\n'));
      lines.push('');
    });
    return lines.join('\n').trim();
  }

  lines.push(`${report.gate} [${report.status.toUpperCase()}]`);
  lines.push(`Profile: ${report.profile}`);
  lines.push(report.summary);
  lines.push('');
  lines.push('Checks:');
  report.checks.forEach((check) => {
    lines.push(`- ${check.status === 'pass' ? 'PASS' : 'FAIL'} ${check.label}`);
    lines.push(`  Command: ${check.command}`);
    lines.push(`  Cwd: ${check.cwd}`);
    lines.push(`  Exit code: ${check.exitCode == null ? 'n/a' : check.exitCode}`);
    lines.push(`  Covers: ${(check.covers || []).join('; ')}`);
    if (check.error) {
      lines.push(`  Error: ${check.error}`);
    }
  });
  if (report.residualRisks && report.residualRisks.length > 0) {
    lines.push('');
    lines.push('Residual risks:');
    report.residualRisks.forEach((risk) => lines.push(`- ${risk}`));
  }
  if (report.unvalidatedSurfaces && report.unvalidatedSurfaces.length > 0) {
    lines.push('');
    lines.push('Unvalidated surfaces:');
    report.unvalidatedSurfaces.forEach((surface) => lines.push(`- ${surface}`));
  }

  return lines.join('\n');
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgv(argv);
  let report;

  try {
    const definition = getGateDefinition(options.mode, process.execPath);
    report = runGateDefinition(definition, { planOnly: options.planOnly });
  } catch (error) {
    if (options.json) {
      process.stdout.write(JSON.stringify({
        gate: options.mode || 'all',
        profile: GATE_PROFILE,
        status: 'fail',
        error: getErrorMessage(error)
      }, null, 2) + '\n');
    } else {
      process.stderr.write(`Pre-push validation gate failed: ${getErrorMessage(error)}\n`);
    }
    process.exitCode = 1;
    return;
  }

  if (options.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    process.stdout.write(renderReport(report) + '\n');
  }

  if (!options.planOnly && report.status !== 'pass') {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  buildFunctionalSmokeChecks,
  buildQaRegressionChecks,
  getGateDefinition,
  getErrorMessage,
  main,
  PACKAGE_ROOT,
  REPO_ROOT,
  renderReport,
  runGateDefinition,
  parseArgv,
  stringifyCommand
};
