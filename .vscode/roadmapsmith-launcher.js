#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const RAW_ARGS = process.argv.slice(2);
const ACTION = RAW_ARGS[0] || 'explain';
const SLASH_ACTIONS = [{"id":"zero","description":"Interview the developer in terminal and generate the first roadmap for an empty or low-context repo.","classicCliExample":"roadmapsmith zero","slashExamples":["/zero","/road zero","/roadmap-sync zero"],"taskLabel":"RoadmapSmith: Zero Mode"},{"id":"maintain","description":"Regenerate, sync, and audit the roadmap for an existing repository.","classicCliExample":"roadmapsmith maintain","slashExamples":["/maintain","/road maintain","/roadmap-sync maintain"],"taskLabel":"RoadmapSmith: Maintain"},{"id":"status","description":"Inspect CLI, roadmap, VS Code task, and Claude hook readiness.","classicCliExample":"roadmapsmith doctor --json","slashExamples":["/status","/road status","/roadmap-sync status"],"taskLabel":"RoadmapSmith: Status"},{"id":"init","description":"Create ROADMAP.md and AGENTS.md when they are missing.","classicCliExample":"roadmapsmith init","slashExamples":["/init","/road init","/roadmap-sync init"],"taskLabel":"RoadmapSmith: Init"},{"id":"generate","description":"Rebuild the managed roadmap block from repository context.","classicCliExample":"roadmapsmith generate --project-root .","slashExamples":["/generate","/road generate","/roadmap-sync generate"],"taskLabel":"RoadmapSmith: Generate"},{"id":"validate","description":"Inspect per-task evidence status as JSON.","classicCliExample":"roadmapsmith validate --json --project-root .","slashExamples":["/validate","/road validate","/roadmap-sync validate"],"taskLabel":"RoadmapSmith: Validate"},{"id":"sync","description":"Apply evidence-backed checklist sync to ROADMAP.md.","classicCliExample":"roadmapsmith sync --project-root .","slashExamples":["/sync","/road sync","/roadmap-sync sync"],"taskLabel":"RoadmapSmith: Sync"},{"id":"audit","description":"Run sync and print the post-sync mismatch summary.","classicCliExample":"roadmapsmith sync --audit --project-root .","slashExamples":["/audit","/road audit","/roadmap-sync audit"],"taskLabel":"RoadmapSmith: Sync Audit"},{"id":"setup","description":"Generate visible VS Code tasks and optional Claude hook wiring.","classicCliExample":"roadmapsmith setup","slashExamples":["/setup","/road setup","/roadmap-sync setup"],"taskLabel":"RoadmapSmith: Refresh Setup"}];
const SLASH_ROOT_ALIASES = new Set(['/road', '/roadmap-sync']);
const DIRECT_SLASH_ALIAS_TO_ACTION = {
  '/zero': 'zero',
  '/maintain': 'maintain',
  '/status': 'status',
  '/init': 'init',
  '/generate': 'generate',
  '/validate': 'validate',
  '/sync': 'sync',
  '/audit': 'audit',
  '/setup': 'setup'
};
const LOCAL_DEV_CLI = path.join(PROJECT_ROOT, 'roadmap-skill', 'bin', 'cli.js');
const LOCAL_PACKAGE_CLI = path.join(PROJECT_ROOT, 'node_modules', 'roadmapsmith', 'bin', 'cli.js');

function candidate(kind, cliPath) {
  return { kind, execPath: process.execPath, prefixArgs: [cliPath], shell: false, displayPath: cliPath };
}

function findGlobalCommandPath() {
  const probe = process.platform === 'win32'
    ? spawnSync('where', ['roadmapsmith'], { encoding: 'utf8' })
    : spawnSync('which', ['roadmapsmith'], { encoding: 'utf8' });
  if (probe.status !== 0 || !probe.stdout) {
    return null;
  }
  const firstLine = probe.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  return firstLine || null;
}

function resolveCli() {
  if (fs.existsSync(LOCAL_DEV_CLI)) {
    return candidate('workspace-dev-copy', LOCAL_DEV_CLI);
  }
  if (fs.existsSync(LOCAL_PACKAGE_CLI)) {
    return candidate('workspace-dependency', LOCAL_PACKAGE_CLI);
  }
  const globalPath = findGlobalCommandPath();
  if (globalPath) {
    return { kind: 'global', execPath: globalPath, prefixArgs: [], shell: process.platform === 'win32', displayPath: globalPath };
  }
  return null;
}

function normalizeActionId(value) {
  return String(value || '').trim().toLowerCase().replace(/^\/+/g, '');
}

function getSlashSuggestions(query) {
  const normalized = normalizeActionId(query);
  if (!normalized) {
    return SLASH_ACTIONS.slice();
  }
  const startsWithMatches = SLASH_ACTIONS.filter((action) => action.id.startsWith(normalized));
  const containsMatches = SLASH_ACTIONS.filter((action) => !action.id.startsWith(normalized) && action.id.includes(normalized));
  return [...startsWithMatches, ...containsMatches];
}

function renderSlashPalette(route) {
  const source = route && route.source ? route.source : '/road';
  const query = normalizeActionId(route && route.query);
  const suggestions = route && Array.isArray(route.suggestions) ? route.suggestions : getSlashSuggestions(query);
  const lines = [];
  lines.push('RoadmapSmith slash palette');
  lines.push('');
  if (query) {
    lines.push(`Input: ${source} ${query}`);
    lines.push(suggestions.length > 0 ? 'No exact slash match was executed. Related actions:' : 'No exact slash match was executed.');
  } else {
    lines.push(`Entry point: ${source}`);
    lines.push('Use an exact slash action to execute work. Incomplete or ambiguous input only shows suggestions.');
  }
  lines.push('');
  if (suggestions.length === 0) {
    lines.push('No related slash actions found.');
  } else {
    suggestions.forEach((action) => {
      lines.push(`- /${action.id}: ${action.description}`);
      lines.push(`  Classic CLI: ${action.classicCliExample}`);
      lines.push(`  Skill form: /roadmap-sync ${action.id}`);
      lines.push(`  VS Code task: ${action.taskLabel}`);
    });
  }
  lines.push('');
  lines.push('Examples:');
  lines.push('- roadmapsmith zero');
  lines.push('- roadmapsmith maintain');
  lines.push('- roadmapsmith /road');
  lines.push('- roadmapsmith /maintain');
  lines.push('- roadmapsmith /roadmap-sync maintain');
  lines.push('');
  lines.push('Installing the skill alone does not expose CLI behavior in VS Code. Use roadmapsmith setup for the visible task/launcher layer.');
  return lines.join('\n');
}

function resolveSlashInvocation(command, args) {
  if (typeof command !== 'string' || !command.trim().startsWith('/')) {
    return null;
  }
  const normalizedCommand = command.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(DIRECT_SLASH_ALIAS_TO_ACTION, normalizedCommand)) {
    return {
      kind: 'execute',
      actionId: DIRECT_SLASH_ALIAS_TO_ACTION[normalizedCommand],
      query: normalizeActionId(normalizedCommand),
      source: normalizedCommand,
      suggestions: getSlashSuggestions(normalizedCommand)
    };
  }
  if (SLASH_ROOT_ALIASES.has(normalizedCommand)) {
    const queryToken = args.length > 0 ? normalizeActionId(args[0]) : '';
    if (!queryToken) {
      return { kind: 'palette', query: '', source: normalizedCommand, suggestions: getSlashSuggestions('') };
    }
    const exactAction = SLASH_ACTIONS.find((action) => action.id === queryToken);
    if (exactAction) {
      return { kind: 'execute', actionId: exactAction.id, query: queryToken, source: normalizedCommand, suggestions: getSlashSuggestions(queryToken) };
    }
    return { kind: 'palette', query: queryToken, source: normalizedCommand, suggestions: getSlashSuggestions(queryToken) };
  }
  return { kind: 'palette', query: normalizeActionId(normalizedCommand), source: normalizedCommand, suggestions: getSlashSuggestions(normalizedCommand) };
}

function explain() {
  console.log('RoadmapSmith layers:\n');
  console.log('1. The roadmap-sync skill guides the agent. It does not add VS Code buttons or install the CLI.');
  console.log('2. The roadmapsmith CLI executes zero/maintain plus the lower-level init/generate/validate/sync/setup/doctor commands.');
  console.log('3. roadmapsmith setup makes the CLI visible in VS Code through tasks and optional Claude hook wiring.\n');
  console.log('Typical VS Code workflow:');
  console.log('- Run "RoadmapSmith: Status" to inspect readiness.');
  console.log('- For empty repos, run "RoadmapSmith: Zero Mode" or use "/road zero".');
  console.log('- For existing repos, run "RoadmapSmith: Maintain" or use "/road maintain".');
  console.log('- Use the lower-level Init, Generate, Validate, and Sync tasks only when you want manual control.\n');
  console.log('If you installed only the skill, install the CLI as well and then run "RoadmapSmith: Refresh Setup".');
}

function printStatusFromDoctor(payload) {
  console.log('RoadmapSmith status\n');
  if (!payload || !payload.cli || !payload.vscode || !payload.hosts) {
    console.log('Doctor could not inspect the full host setup. Raw payload follows:\n');
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(`Project root: ${payload.projectRoot}`);
  console.log(`CLI resolution: ${payload.cli.kind}${payload.cli.path ? ` (${payload.cli.path})` : ''}${payload.cli.ready ? '' : ' [missing]'}`);
  console.log(`Roadmap file: ${payload.roadmap.exists ? 'ready' : 'missing'} (${payload.roadmap.path})`);
  console.log(`Agent rules: ${payload.agents.exists ? 'ready' : 'missing'} (${payload.agents.path})`);
  console.log(`VS Code launcher: ${payload.vscode.launcher.exists ? 'ready' : 'missing'} (${payload.vscode.launcher.path})`);
  console.log(`VS Code task wrappers: ${payload.vscode.wrappers.ready ? 'ready' : 'incomplete'} (${payload.vscode.wrappers.presentCount}/${payload.vscode.wrappers.expectedCount} files)`);
  console.log(`VS Code tasks: ${payload.vscode.tasks.ready ? 'ready' : 'incomplete'} (${payload.vscode.tasks.presentLabels.length}/${payload.vscode.tasks.expectedLabels.length} tasks)`);
  console.log(`Node runtime: ${payload.runtime.ready ? `ready (${payload.runtime.kind}${payload.runtime.path ? `: ${payload.runtime.path}` : ''})` : 'missing'}`);
  if (!payload.vscode.tasks.ready && payload.vscode.tasks.missingLabels.length > 0) {
    console.log(`Missing VS Code tasks: ${payload.vscode.tasks.missingLabels.join(', ')}`);
  }
  if (!payload.vscode.wrappers.ready) {
    console.log(`Missing task wrapper files: ${payload.vscode.wrappers.missingPaths.join(', ')}`);
  }
  console.log(`Codex readiness: ${payload.hosts.codex.ready ? 'ready' : 'needs setup'} (${payload.hosts.codex.message})`);
  console.log(`Claude readiness: ${payload.hosts.claude.ready ? 'ready' : 'needs setup'} (${payload.hosts.claude.message})`);
  if (!payload.cli.ready) {
    console.log('\nThe CLI is missing. Installing the skill alone does not expose RoadmapSmith actions in VS Code.');
    console.log('Install the CLI, then run "RoadmapSmith: Refresh Setup".');
  }
  if (!payload.runtime.ready) {
    console.log('\nThe VS Code task runtime is missing. Install Node.js or set ROADMAPSMITH_NODE, then rerun "RoadmapSmith: Status".');
  }
  console.log('\nRecommended entrypoints: roadmapsmith zero, roadmapsmith maintain');
  console.log('Slash entrypoints: /road, /zero, /maintain, /status, /generate, /validate, /sync, /audit, /setup, /roadmap-sync <action>');
}

function printMissingCliStatus() {
  console.log('RoadmapSmith status\n');
  console.log(`Project root: ${PROJECT_ROOT}`);
  console.log('CLI resolution: missing');
  console.log('VS Code tasks are visible because setup generated this launcher, but no RoadmapSmith CLI could be resolved.');
  console.log('Installing the skill alone does not expose the CLI in VS Code.');
  console.log('Install the roadmapsmith package, then run "RoadmapSmith: Refresh Setup".');
  console.log('The launcher looks for, in order: workspace dev copy, workspace dependency, global command.');
  console.log('Slash discovery still works here: try /road for the local palette.');
}

function runCli(args, options = {}) {
  const resolution = resolveCli();
  if (!resolution) {
    if (options.allowMissingCli) {
      return { status: 0, stdout: '', stderr: '', missingCli: true };
    }
    console.error('RoadmapSmith CLI not found. Install the CLI and rerun setup.');
    process.exitCode = 1;
    return null;
  }
  const result = spawnSync(resolution.execPath, [...resolution.prefixArgs, ...args], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    shell: resolution.shell,
    stdio: options.capture ? 'pipe' : 'inherit'
  });
  return { ...result, resolution };
}

function forwardResult(result) {
  if (!result) {
    return;
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    process.exitCode = result.status;
  }
}

function status() {
  const result = runCli(['doctor', '--project-root', PROJECT_ROOT, '--json'], { capture: true, allowMissingCli: true });
  if (!result || result.missingCli) {
    printMissingCliStatus();
    return;
  }
  if (result.stdout) {
    try {
      printStatusFromDoctor(JSON.parse(result.stdout));
      return;
    } catch (_) {}
  }
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = 0;
}

const actionToCliArgs = {
  zero: ['zero', '--project-root', PROJECT_ROOT],
  maintain: ['maintain', '--project-root', PROJECT_ROOT],
  init: ['init'],
  generate: ['generate', '--project-root', PROJECT_ROOT],
  validate: ['validate', '--json', '--project-root', PROJECT_ROOT],
  sync: ['sync', '--project-root', PROJECT_ROOT],
  audit: ['sync', '--audit', '--project-root', PROJECT_ROOT],
  'sync-dry-run': ['sync', '--dry-run', '--project-root', PROJECT_ROOT],
  'sync-audit': ['sync', '--audit', '--project-root', PROJECT_ROOT],
  setup: ['setup', '--project-root', PROJECT_ROOT]
};

const slashInvocation = resolveSlashInvocation(ACTION, RAW_ARGS.slice(1));

if (slashInvocation) {
  if (slashInvocation.kind === 'palette') {
    console.log(renderSlashPalette(slashInvocation));
  } else if (slashInvocation.actionId === 'status') {
    status();
  } else if (Object.prototype.hasOwnProperty.call(actionToCliArgs, slashInvocation.actionId)) {
    const result = runCli(actionToCliArgs[slashInvocation.actionId]);
    forwardResult(result);
  } else {
    console.log(renderSlashPalette(slashInvocation));
  }
} else if (ACTION === 'explain') {
  explain();
} else if (ACTION === 'status') {
  status();
} else if (Object.prototype.hasOwnProperty.call(actionToCliArgs, ACTION)) {
  const result = runCli(actionToCliArgs[ACTION]);
  forwardResult(result);
} else {
  console.error(`Unknown RoadmapSmith launcher action: ${ACTION}`);
  process.exitCode = 1;
}
