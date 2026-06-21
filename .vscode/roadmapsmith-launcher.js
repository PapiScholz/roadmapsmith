#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const RAW_ARGS = process.argv.slice(2);
const ACTION = RAW_ARGS[0] || 'explain';
const SLASH_ACTIONS = [{"id":"zero","tier":"canonical","description":"Interview the developer in terminal and generate the first roadmap for an empty or low-context repo.","classicCliExample":"roadmapsmith zero","taskLabel":"RoadmapSmith: Zero Mode","directSlash":"/roadmap-zero","routerSlash":"/roadmap zero","legacyRouterSlash":"/roadmap-sync zero"},{"id":"maintain","tier":"canonical","description":"Preserve-first existing-repo flow: update, sync, and audit the roadmap without rebuilding substantive domain content.","classicCliExample":"roadmapsmith maintain","taskLabel":"RoadmapSmith: Maintain","directSlash":"/roadmap-maintain","routerSlash":"/roadmap maintain","legacyRouterSlash":"/roadmap-sync maintain"},{"id":"status","tier":"canonical","description":"Inspect CLI, roadmap, VS Code task, Codex, and Claude readiness.","classicCliExample":"roadmapsmith status --json","taskLabel":"RoadmapSmith: Status","directSlash":"/roadmap-status","routerSlash":"/roadmap status","legacyRouterSlash":"/roadmap-sync status"},{"id":"validate","tier":"canonical","description":"Inspect per-task evidence status as JSON.","classicCliExample":"roadmapsmith validate --json --project-root .","taskLabel":"RoadmapSmith: Validate","directSlash":"/roadmap-validate","routerSlash":"/roadmap validate","legacyRouterSlash":"/roadmap-sync validate"},{"id":"update","tier":"canonical","aliases":["sync"],"description":"Apply evidence-backed checklist refresh to ROADMAP.md or complete one task with verified evidence.","classicCliExample":"roadmapsmith update --project-root .","taskLabel":"RoadmapSmith: Update","directSlash":"/roadmap-update","routerSlash":"/roadmap update","legacyRouterSlash":"/roadmap-sync update"},{"id":"setup","tier":"canonical","description":"Generate visible VS Code tasks and optional Claude hook wiring.","classicCliExample":"roadmapsmith setup","taskLabel":"RoadmapSmith: Refresh Setup","directSlash":"/roadmap-setup","routerSlash":"/roadmap setup","legacyRouterSlash":"/roadmap-sync setup"},{"id":"init","tier":"advanced","description":"Create ROADMAP.md and AGENTS.md when they are missing.","classicCliExample":"roadmapsmith init","taskLabel":"RoadmapSmith: Init","directSlash":"/roadmap-init","routerSlash":"/roadmap init","legacyRouterSlash":"/roadmap-sync init"},{"id":"generate","tier":"advanced","description":"Generate or update ROADMAP.md, refusing destructive replacement unless rerun with --full-regen.","classicCliExample":"roadmapsmith generate --project-root .","taskLabel":"RoadmapSmith: Generate","directSlash":"/roadmap-generate","routerSlash":"/roadmap generate","legacyRouterSlash":"/roadmap-sync generate"},{"id":"audit","tier":"advanced","description":"Run sync and print the post-sync mismatch summary.","classicCliExample":"roadmapsmith sync --audit --project-root .","taskLabel":"RoadmapSmith: Sync Audit","directSlash":"/roadmap-audit","routerSlash":"/roadmap audit","legacyRouterSlash":"/roadmap-sync audit"}];
const SLASH_ROOT_ALIASES = new Set(['/roadmap', '/road']);
const LEGACY_ROUTER_ALIAS = '/roadmap-sync';
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

function getNamespacedDirectSlash(actionId) {
  return `/roadmap-${actionId}`;
}

const DIRECT_HOST_NATIVE_ALIAS_TO_ACTION = Object.fromEntries(
  SLASH_ACTIONS.map((action) => [getNamespacedDirectSlash(action.id), action.id])
);
const DIRECT_DEPRECATED_CLI_ALIAS_TO_ACTION = Object.fromEntries(
  SLASH_ACTIONS.flatMap((action) => {
    const aliases = Array.isArray(action.aliases) ? action.aliases : [];
    return [action.id, ...aliases].map((alias) => [`/${alias}`, action.id]);
  })
);
const ACTION_ALIAS_TO_ID = Object.fromEntries(
  SLASH_ACTIONS.flatMap((action) => {
    const aliases = Array.isArray(action.aliases) ? action.aliases : [];
    return [action.id, ...aliases].map((alias) => [alias, action.id]);
  })
);

function normalizeActionId(value) {
  let normalized = String(value || '').trim().toLowerCase().replace(/^\/+/g, '');
  if (normalized.startsWith('roadmap-')) {
    normalized = normalized.slice('roadmap-'.length);
  }
  return normalized;
}

function canonicalizeActionId(value) {
  const normalized = normalizeActionId(value);
  return ACTION_ALIAS_TO_ID[normalized] || normalized;
}

function actionSearchTerms(action) {
  return [action.id, ...(Array.isArray(action.aliases) ? action.aliases : [])];
}

function getSlashSuggestions(query) {
  const normalized = normalizeActionId(query);
  if (!normalized) {
    return SLASH_ACTIONS.slice();
  }
  const startsWithMatches = SLASH_ACTIONS.filter((action) => actionSearchTerms(action).some((term) => term.startsWith(normalized)));
  const containsMatches = SLASH_ACTIONS.filter((action) => {
    return !actionSearchTerms(action).some((term) => term.startsWith(normalized))
      && actionSearchTerms(action).some((term) => term.includes(normalized));
  });
  return [...startsWithMatches, ...containsMatches];
}

function renderSlashPalette(route) {
  const source = route && route.source ? route.source : '/roadmap';
  const query = normalizeActionId(route && route.query);
  const suggestions = route && Array.isArray(route.suggestions) ? route.suggestions : getSlashSuggestions(query);
  const lines = [];
  lines.push('RoadmapSmith slash palette');
  lines.push('');
  if (route && route.deprecated && route.deprecationMessage) {
    lines.push(`Deprecated alias: ${route.deprecationMessage}`);
    lines.push('');
  }
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
      lines.push(`- ${action.directSlash}: ${action.description}`);
      lines.push(`  Router form: ${action.routerSlash}`);
      lines.push(`  Legacy router: ${action.legacyRouterSlash}`);
      lines.push(`  Classic CLI: ${action.classicCliExample}`);
      lines.push(`  VS Code task: ${action.taskLabel}`);
    });
  }
  lines.push('');
  lines.push('Examples:');
  lines.push('- roadmapsmith /roadmap');
  lines.push('- roadmapsmith /roadmap maintain');
  lines.push('- roadmapsmith /roadmap-maintain');
  lines.push('- roadmapsmith /roadmap-update');
  lines.push('- roadmapsmith /roadmap-sync validate');
  lines.push('');
  lines.push('Installing the skill alone does not expose CLI behavior in VS Code. Use roadmapsmith setup for the visible task/launcher layer.');
  return lines.join('\n');
}

function getSlashAction(actionId) {
  const normalized = canonicalizeActionId(actionId);
  return SLASH_ACTIONS.find((action) => action.id === normalized) || null;
}

function paletteResponse(source, query, deprecated = false, deprecationMessage = '') {
  return { kind: 'palette', query, source, suggestions: getSlashSuggestions(query), deprecated, deprecationMessage };
}

function executeResponse(source, actionId, query, deprecated = false, deprecationMessage = '') {
  return { kind: 'execute', actionId, query, source, suggestions: getSlashSuggestions(query), deprecated, deprecationMessage };
}

function resolveSlashInvocation(command, args) {
  if (typeof command !== 'string' || !command.trim().startsWith('/')) {
    return null;
  }
  const normalizedCommand = command.trim().toLowerCase();
  if (normalizedCommand === LEGACY_ROUTER_ALIAS) {
    if (args.length === 0) {
      return paletteResponse(normalizedCommand, '');
    }
    const queryToken = normalizeActionId(args[0]);
    const deprecationMessage = 'Legacy CLI compatibility root /roadmap-sync <action> is deprecated. Use /roadmap <action> or the direct /roadmap-* commands.';
    const exactAction = getSlashAction(queryToken);
    if (exactAction) {
      return executeResponse(normalizedCommand, exactAction.id, queryToken, true, deprecationMessage);
    }
    return paletteResponse(normalizedCommand, queryToken, true, deprecationMessage);
  }
  if (Object.prototype.hasOwnProperty.call(DIRECT_HOST_NATIVE_ALIAS_TO_ACTION, normalizedCommand)) {
    return executeResponse(normalizedCommand, DIRECT_HOST_NATIVE_ALIAS_TO_ACTION[normalizedCommand], normalizeActionId(normalizedCommand));
  }
  if (Object.prototype.hasOwnProperty.call(DIRECT_DEPRECATED_CLI_ALIAS_TO_ACTION, normalizedCommand)) {
    const actionId = DIRECT_DEPRECATED_CLI_ALIAS_TO_ACTION[normalizedCommand];
    return executeResponse(
      normalizedCommand,
      actionId,
      normalizeActionId(normalizedCommand),
      true,
      `CLI compatibility alias ${normalizedCommand} is deprecated. Use ${getNamespacedDirectSlash(actionId)} or /roadmap ${actionId}.`
    );
  }
  if (SLASH_ROOT_ALIASES.has(normalizedCommand)) {
    const queryToken = args.length > 0 ? normalizeActionId(args[0]) : '';
    const deprecated = normalizedCommand === '/road';
    const deprecationMessage = deprecated ? 'CLI compatibility alias /road is deprecated. Use /roadmap.' : '';
    if (!queryToken) {
      return paletteResponse(normalizedCommand, '', deprecated, deprecationMessage);
    }
    const exactAction = getSlashAction(queryToken);
    if (exactAction) {
      return executeResponse(normalizedCommand, exactAction.id, queryToken, deprecated, deprecationMessage);
    }
    return paletteResponse(normalizedCommand, queryToken, deprecated, deprecationMessage);
  }
  if (normalizedCommand.startsWith('/roadmap-')) {
    return paletteResponse(normalizedCommand, normalizeActionId(normalizedCommand));
  }
  return paletteResponse(normalizedCommand, normalizeActionId(normalizedCommand));
}

function explain() {
  console.log('RoadmapSmith layers:\n');
  console.log('1. The roadmap-sync skill guides the agent. It does not add VS Code buttons or install the CLI.');
  console.log('2. The roadmapsmith CLI executes zero/maintain plus the canonical update family, with sync kept as the advanced alias for manual refresh and doctor kept as a compatibility alias.');
  console.log('3. roadmapsmith setup makes the CLI visible in VS Code through tasks and optional Claude hook wiring.\n');
  console.log('Typical VS Code workflow:');
  console.log('- Run "RoadmapSmith: Status" to inspect readiness.');
  console.log('- For empty repos, run "RoadmapSmith: Zero Mode" or use "/roadmap zero".');
  console.log('- For existing repos, run "RoadmapSmith: Maintain" or use "/roadmap maintain".');
  console.log('- Use Update for the public checklist-refresh/task-completion family, and use Init, Generate, Validate, and Sync when you want manual control.\n');
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
  if (payload.summary) {
    console.log('\nStructured readiness summary:');
    console.log(`- Workspace readiness: ${payload.summary.workspaceReady ? 'ready' : 'needs setup'}`);
    console.log(`- Codex readiness: ${payload.summary.codexReady ? 'ready' : 'needs setup'}`);
    console.log(`- Claude readiness: ${payload.summary.claudeReady ? 'ready' : 'needs setup'}`);
    console.log(`- Canonical native surfaces: ${payload.summary.canonicalSurfaceReady ? 'ready' : 'needs attention'}`);
    if (Array.isArray(payload.summary.advancedSurfaceWarnings)) {
      payload.summary.advancedSurfaceWarnings.forEach((warning) => console.log(`- Advanced warning: ${warning}`));
    }
  }
  if (payload.surfaces && typeof payload.surfaces === 'object') {
    console.log('\nNative slash surfaces:');
    Object.entries(payload.surfaces).forEach(([surfaceKey, surface]) => {
      const label = surfaceKey.replace(/([A-Z])/g, ' $1').replace(/^./, (character) => character.toUpperCase());
      console.log(`- ${label}: ${surface.ready ? 'ready' : 'needs attention'} (${surface.message})`);
      console.log(`  Source: ${surface.source}`);
      console.log(`  Verification: ${surface.verification}`);
      if (Array.isArray(surface.missingCommands) && surface.missingCommands.length > 0) {
        console.log(`  Missing commands: ${surface.missingCommands.join(', ')}`);
      }
      if (Array.isArray(surface.duplicates) && surface.duplicates.length > 0) {
        console.log(`  Duplicates: ${surface.duplicates.map((duplicate) => duplicate.command).join(', ')}`);
      }
    });
  }
  if (!payload.cli.ready) {
    console.log('\nThe CLI is missing. Installing the skill alone does not expose RoadmapSmith actions in VS Code.');
    console.log('Install the CLI, then run "RoadmapSmith: Refresh Setup".');
  }
  if (!payload.runtime.ready) {
    console.log('\nThe VS Code task runtime is missing. Install Node.js or set ROADMAPSMITH_NODE, then rerun "RoadmapSmith: Status".');
  }
  console.log('\nRecommended entrypoints: roadmapsmith zero, roadmapsmith maintain, roadmapsmith update');
  console.log('Compatibility note: roadmapsmith doctor mirrors this payload for existing automation.');
  console.log('Slash entrypoints: /roadmap, /roadmap-zero, /roadmap-maintain, /roadmap-status, /roadmap-init, /roadmap-generate, /roadmap-validate, /roadmap-update, /roadmap-audit, /roadmap-setup, plus legacy /roadmap-sync <action>.');
}

function printMissingCliStatus() {
  console.log('RoadmapSmith status\n');
  console.log(`Project root: ${PROJECT_ROOT}`);
  console.log('CLI resolution: missing');
  console.log('VS Code tasks are visible because setup generated this launcher, but no RoadmapSmith CLI could be resolved.');
  console.log('Installing the skill alone does not expose the CLI in VS Code.');
  console.log('Install the roadmapsmith package, then run "RoadmapSmith: Refresh Setup".');
  console.log('The launcher looks for, in order: workspace dev copy, workspace dependency, global command.');
  console.log('Slash discovery still works here: try /roadmap for the local palette.');
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
  const result = runCli(['status', '--project-root', PROJECT_ROOT, '--json'], { capture: true, allowMissingCli: true });
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
  update: ['update', '--project-root', PROJECT_ROOT],
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
    if (slashInvocation.deprecated && slashInvocation.deprecationMessage) {
      console.error(slashInvocation.deprecationMessage);
    }
    status();
  } else if (Object.prototype.hasOwnProperty.call(actionToCliArgs, slashInvocation.actionId)) {
    if (slashInvocation.deprecated && slashInvocation.deprecationMessage) {
      console.error(slashInvocation.deprecationMessage);
    }
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
