'use strict';

const fs = require('fs');
const path = require('path');
const { readTextIfExists, writeText } = require('./io');
const { getSlashActionSpecs } = require('./slash');

const SUPPORTED_EDITORS = new Set(['vscode']);
const SUPPORTED_HOSTS = new Set(['codex', 'claude']);
const VSCODE_LAUNCHER_RELATIVE_PATH = '.vscode/roadmapsmith-launcher.js';
const WINDOWS_TASK_WRAPPER_RELATIVE_PATH = '.vscode/roadmapsmith-task.cmd';
const POSIX_TASK_WRAPPER_RELATIVE_PATH = '.vscode/roadmapsmith-task.sh';
const ROADMAPSMITH_TASK_LABELS = [
  'RoadmapSmith: Zero Mode',
  'RoadmapSmith: Maintain',
  'RoadmapSmith: Status',
  'RoadmapSmith: Explain Workflow',
  'RoadmapSmith: Init',
  'RoadmapSmith: Generate',
  'RoadmapSmith: Validate',
  'RoadmapSmith: Sync',
  'RoadmapSmith: Sync Dry Run',
  'RoadmapSmith: Sync Audit',
  'RoadmapSmith: Refresh Setup'
];
const CLAUDE_HOOK_COMMAND = 'node .claude/hooks/roadmap-sync.js';
const CLAUDE_HOOK_RELATIVE_PATH = '.claude/hooks/roadmap-sync.js';

function removeJsonComments(content) {
  let result = '';
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < content.length; i += 1) {
    const current = content[i];
    const next = content[i + 1];

    if (lineComment) {
      if (current === '\n') {
        lineComment = false;
        result += current;
      }
      continue;
    }

    if (blockComment) {
      if (current === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }

    if (inString) {
      result += current;
      if (escaped) {
        escaped = false;
      } else if (current === '\\') {
        escaped = true;
      } else if (current === '"') {
        inString = false;
      }
      continue;
    }

    if (current === '"') {
      inString = true;
      result += current;
      continue;
    }

    if (current === '/' && next === '/') {
      lineComment = true;
      i += 1;
      continue;
    }

    if (current === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }

    result += current;
  }

  return result;
}

function removeTrailingCommas(content) {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < content.length; i += 1) {
    const current = content[i];

    if (inString) {
      result += current;
      if (escaped) {
        escaped = false;
      } else if (current === '\\') {
        escaped = true;
      } else if (current === '"') {
        inString = false;
      }
      continue;
    }

    if (current === '"') {
      inString = true;
      result += current;
      continue;
    }

    if (current === ',') {
      let cursor = i + 1;
      while (cursor < content.length && /\s/.test(content[cursor])) {
        cursor += 1;
      }
      if (content[cursor] === '}' || content[cursor] === ']') {
        continue;
      }
    }

    result += current;
  }

  return result;
}

function parseJsonc(content, filePath) {
  const sanitized = removeTrailingCommas(removeJsonComments(String(content || '').replace(/^\uFEFF/, '')));
  try {
    return JSON.parse(sanitized);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
  }
}

function readJsoncObject(filePath) {
  const content = readTextIfExists(filePath);
  if (content == null) {
    return null;
  }
  const parsed = parseJsonc(content, filePath);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Expected a JSON object in ${filePath}`);
  }
  return parsed;
}

function stringifyJson(value) {
  return JSON.stringify(value, null, 2);
}

function normalizeHostValue(host) {
  return String(host || '').trim().toLowerCase();
}

function parseHosts(hostValue) {
  const rawHosts = Array.isArray(hostValue)
    ? hostValue.flatMap((entry) => String(entry).split(','))
    : String(hostValue || 'codex,claude').split(',');
  const result = [];
  const seen = new Set();

  for (const rawHost of rawHosts) {
    const host = normalizeHostValue(rawHost);
    if (!host) {
      continue;
    }
    if (!SUPPORTED_HOSTS.has(host)) {
      throw new Error(`Unsupported host "${host}". Supported hosts: codex, claude`);
    }
    if (seen.has(host)) {
      continue;
    }
    seen.add(host);
    result.push(host);
  }

  if (result.length === 0) {
    throw new Error('At least one host must be selected for setup');
  }

  return result;
}

function assertSupportedEditor(editorValue) {
  const editor = String(editorValue || 'vscode').trim().toLowerCase();
  if (!SUPPORTED_EDITORS.has(editor)) {
    throw new Error(`Unsupported editor "${editor}". Supported editors: vscode`);
  }
  return editor;
}

function createTask(action, label, detail) {
  return {
    label,
    type: 'process',
    command: 'sh',
    args: [POSIX_TASK_WRAPPER_RELATIVE_PATH, action],
    windows: {
      command: 'cmd.exe',
      args: ['/d', '/c', WINDOWS_TASK_WRAPPER_RELATIVE_PATH.replace(/\//g, '\\'), action]
    },
    options: {
      cwd: '${workspaceFolder}'
    },
    problemMatcher: [],
    presentation: {
      reveal: 'always',
      panel: 'shared',
      clear: true
    },
    detail
  };
}

function createManagedTasks() {
  return [
    createTask('zero', 'RoadmapSmith: Zero Mode', 'Run the Zero Mode interview and generate the first roadmap in one command.'),
    createTask('maintain', 'RoadmapSmith: Maintain', 'Run the default existing-repo flow: generate, sync, and audit in one command.'),
    createTask('status', 'RoadmapSmith: Status', 'Inspect readiness and learn the slash entrypoints like /road and /roadmap-sync <action>.'),
    createTask('explain', 'RoadmapSmith: Explain Workflow', 'Explain how zero, maintain, the skill, setup, slash routing, and VS Code tasks work together.'),
    createTask('init', 'RoadmapSmith: Init', 'Create ROADMAP.md and AGENTS.md when they are missing.'),
    createTask('generate', 'RoadmapSmith: Generate', 'Rebuild the managed roadmap block from repository context.'),
    createTask('validate', 'RoadmapSmith: Validate', 'Inspect per-task evidence status as JSON.'),
    createTask('sync', 'RoadmapSmith: Sync', 'Apply evidence-backed checklist sync to ROADMAP.md.'),
    createTask('sync-dry-run', 'RoadmapSmith: Sync Dry Run', 'Preview the next roadmap sync without writing files.'),
    createTask('sync-audit', 'RoadmapSmith: Sync Audit', 'Run sync and print the post-sync mismatch summary.'),
    createTask('setup', 'RoadmapSmith: Refresh Setup', 'Reapply RoadmapSmith VS Code and host integration files.')
  ];
}

function mergeVsCodeTasks(existingConfig) {
  const config = existingConfig ? { ...existingConfig } : {};
  const existingTasks = Array.isArray(config.tasks) ? config.tasks.slice() : [];
  const managedLabels = new Set(ROADMAPSMITH_TASK_LABELS);
  const unmanagedTasks = existingTasks.filter((task) => !managedLabels.has(task && task.label));

  return {
    ...config,
    version: typeof config.version === 'string' ? config.version : '2.0.0',
    tasks: [...createManagedTasks(), ...unmanagedTasks]
  };
}

function createClaudeHookEntry() {
  return {
    matcher: 'Write|Edit|MultiEdit',
    hooks: [
      {
        type: 'command',
        command: CLAUDE_HOOK_COMMAND,
        timeout: 30
      }
    ]
  };
}

function isRoadmapSmithHookEntry(entry) {
  if (!entry || !Array.isArray(entry.hooks)) {
    return false;
  }
  return entry.hooks.some((hook) => hook && hook.command === CLAUDE_HOOK_COMMAND);
}

function mergeClaudeSettings(existingConfig) {
  const config = existingConfig ? { ...existingConfig } : {};
  const hooks = config.hooks && typeof config.hooks === 'object' && !Array.isArray(config.hooks)
    ? { ...config.hooks }
    : {};
  const postToolUse = Array.isArray(hooks.PostToolUse) ? hooks.PostToolUse.slice() : [];
  const withoutManagedEntry = postToolUse.filter((entry) => !isRoadmapSmithHookEntry(entry));

  hooks.PostToolUse = [createClaudeHookEntry(), ...withoutManagedEntry];

  return {
    ...config,
    hooks
  };
}

function renderClaudeHookScript() {
  return [
    '#!/usr/bin/env node',
    '\'use strict\';',
    '',
    'const path = require(\'path\');',
    'const fs = require(\'fs\');',
    'const { execFileSync } = require(\'child_process\');',
    '',
    '// .claude/hooks/ -> project root (two levels up)',
    'const PROJECT_ROOT = path.resolve(__dirname, \'../..\');',
    'const CLI = path.join(PROJECT_ROOT, \'roadmap-skill\', \'bin\', \'cli.js\');',
    'const LOCK_FILE = path.join(__dirname, \'.sync.lock\');',
    '',
    'let data = \'\';',
    'process.stdin.setEncoding(\'utf8\');',
    'process.stdin.on(\'data\', chunk => { data += chunk; });',
    'process.stdin.on(\'end\', () => {',
    '  let filePath = \'\';',
    '  try {',
    '    const parsed = JSON.parse(data);',
    '    filePath = (parsed && parsed.tool_input && parsed.tool_input.file_path) || \'\';',
    '  } catch (_) {',
    '    process.exit(0);',
    '  }',
    '',
    '  const normalised = filePath.replace(/\\\\/g, \'/\');',
    '  if (!normalised || normalised.endsWith(\'/ROADMAP.md\')) {',
    '    process.exit(0);',
    '  }',
    '',
    '  if (fs.existsSync(LOCK_FILE)) {',
    '    process.exit(0);',
    '  }',
    '',
    '  try {',
    '    fs.writeFileSync(LOCK_FILE, String(process.pid));',
    '    execFileSync(process.execPath, [CLI, \'sync\', \'--project-root\', PROJECT_ROOT], {',
    '      stdio: \'inherit\'',
    '    });',
    '  } catch (err) {',
    '    process.stderr.write(\'roadmapsmith sync failed: \' + (err.message || String(err)) + \'\\n\');',
    '  } finally {',
    '    try { fs.unlinkSync(LOCK_FILE); } catch (_) {}',
    '  }',
    '});',
    ''
  ].join('\n');
}

function renderWindowsTaskWrapper() {
  return [
    '@echo off',
    'setlocal',
    'set "SCRIPT_DIR=%~dp0"',
    'set "ACTION=%~1"',
    'if not defined ACTION set "ACTION=explain"',
    'call :resolve_node',
    'if defined ROADMAPSMITH_NODE_RESOLVED goto run_launcher',
    'echo RoadmapSmith VS Code task runtime error',
    'echo.',
    'echo VS Code tasks are installed, but the Node runtime needed to start RoadmapSmith could not be resolved.',
    'echo RoadmapSmith itself may still be installed and the CLI may still be available.',
    'echo Missing piece: the Node runtime used to start .vscode\\roadmapsmith-launcher.js',
    'echo Recovery: install Node.js or set ROADMAPSMITH_NODE to a working node executable path, then rerun RoadmapSmith: Status.',
    'if /I "%ACTION%"=="status" exit /b 0',
    'if /I "%ACTION%"=="explain" exit /b 0',
    'exit /b 1',
    '',
    ':run_launcher',
    '"%ROADMAPSMITH_NODE_RESOLVED%" "%SCRIPT_DIR%roadmapsmith-launcher.js" %*',
    'exit /b %ERRORLEVEL%',
    '',
    ':resolve_node',
    'set "ROADMAPSMITH_NODE_RESOLVED="',
    'if defined ROADMAPSMITH_NODE if exist "%ROADMAPSMITH_NODE%" set "ROADMAPSMITH_NODE_RESOLVED=%ROADMAPSMITH_NODE%"',
    'if defined ROADMAPSMITH_NODE if not defined ROADMAPSMITH_NODE_RESOLVED call :resolve_command "%ROADMAPSMITH_NODE%"',
    'if defined ROADMAPSMITH_NODE_RESOLVED exit /b 0',
    'for /f "delims=" %%I in (\'where node 2^>nul\') do (',
    '  set "ROADMAPSMITH_NODE_RESOLVED=%%~fI"',
    '  goto :node_resolved',
    ')',
    'if not defined ROADMAPSMITH_NODE_RESOLVED if defined ProgramFiles if exist "%ProgramFiles%\\nodejs\\node.exe" set "ROADMAPSMITH_NODE_RESOLVED=%ProgramFiles%\\nodejs\\node.exe"',
    'if not defined ROADMAPSMITH_NODE_RESOLVED if defined ProgramFiles(x86) if exist "%ProgramFiles(x86)%\\nodejs\\node.exe" set "ROADMAPSMITH_NODE_RESOLVED=%ProgramFiles(x86)%\\nodejs\\node.exe"',
    'if not defined ROADMAPSMITH_NODE_RESOLVED if defined LocalAppData if exist "%LocalAppData%\\Programs\\nodejs\\node.exe" set "ROADMAPSMITH_NODE_RESOLVED=%LocalAppData%\\Programs\\nodejs\\node.exe"',
    'if not defined ROADMAPSMITH_NODE_RESOLVED if defined LocalAppData if exist "%LocalAppData%\\Volta\\bin\\node.exe" set "ROADMAPSMITH_NODE_RESOLVED=%LocalAppData%\\Volta\\bin\\node.exe"',
    ':node_resolved',
    'exit /b 0',
    '',
    ':resolve_command',
    'for /f "delims=" %%I in (\'where %~1 2^>nul\') do (',
    '  set "ROADMAPSMITH_NODE_RESOLVED=%%~fI"',
    '  goto :eof',
    ')',
    'exit /b 0'
  ].join('\n');
}

function renderPosixTaskWrapper() {
  return [
    '#!/bin/sh',
    'set -eu',
    'SCRIPT_PATH="$0"',
    'case "${SCRIPT_PATH}" in',
    '  */*) ;;',
    '  *) SCRIPT_PATH="./${SCRIPT_PATH}" ;;',
    'esac',
    'SCRIPT_DIR=$(CDPATH= cd -- "${SCRIPT_PATH%/*}" && pwd)',
    'ACTION="${1:-explain}"',
    'ROADMAPSMITH_NODE_RESOLVED=""',
    'if [ -n "${ROADMAPSMITH_NODE:-}" ]; then',
    '  if [ -x "${ROADMAPSMITH_NODE}" ]; then',
    '    ROADMAPSMITH_NODE_RESOLVED="${ROADMAPSMITH_NODE}"',
    '  elif command -v -- "${ROADMAPSMITH_NODE}" >/dev/null 2>&1; then',
    '    ROADMAPSMITH_NODE_RESOLVED=$(command -v -- "${ROADMAPSMITH_NODE}")',
    '  fi',
    'fi',
    'if [ -z "${ROADMAPSMITH_NODE_RESOLVED}" ] && command -v node >/dev/null 2>&1; then',
    '  ROADMAPSMITH_NODE_RESOLVED=$(command -v node)',
    'fi',
    'if [ -z "${ROADMAPSMITH_NODE_RESOLVED}" ]; then',
    '  echo "RoadmapSmith VS Code task runtime error"',
    '  echo',
    '  echo "VS Code tasks are installed, but the Node runtime needed to start RoadmapSmith could not be resolved."',
    '  echo "RoadmapSmith itself may still be installed and the CLI may still be available."',
    '  echo "Missing piece: the Node runtime used to start .vscode/roadmapsmith-launcher.js"',
    '  echo "Recovery: install Node.js or set ROADMAPSMITH_NODE to a working node executable path, then rerun RoadmapSmith: Status."',
    '  case "${ACTION}" in',
    '    status|explain) exit 0 ;;',
    '    *) exit 1 ;;',
    '  esac',
    'fi',
    'exec "${ROADMAPSMITH_NODE_RESOLVED}" "${SCRIPT_DIR}/roadmapsmith-launcher.js" "$@"'
  ].join('\n');
}

function findCommandPath(commandName, env = process.env) {
  const probe = process.platform === 'win32'
    ? require('child_process').spawnSync('where', [commandName], { encoding: 'utf8', env })
    : require('child_process').spawnSync('which', [commandName], { encoding: 'utf8', env });
  if (probe.status !== 0 || !probe.stdout) {
    return null;
  }
  return probe.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || null;
}

function detectNodeRuntime(env = process.env) {
  const override = String((env && env.ROADMAPSMITH_NODE) || '').trim();
  if (override) {
    if (fs.existsSync(override)) {
      return { ready: true, kind: 'env-override', path: override };
    }
    const overrideCommandPath = findCommandPath(override, env);
    if (overrideCommandPath) {
      return { ready: true, kind: 'env-override', path: overrideCommandPath };
    }
  }

  const pathNode = findCommandPath('node', env);
  if (pathNode) {
    return { ready: true, kind: 'path', path: pathNode };
  }

  if (process.platform === 'win32') {
    const candidateSpecs = [
      { kind: 'program-files', path: env && env.ProgramFiles ? path.join(env.ProgramFiles, 'nodejs', 'node.exe') : null },
      { kind: 'program-files-x86', path: env && env['ProgramFiles(x86)'] ? path.join(env['ProgramFiles(x86)'], 'nodejs', 'node.exe') : null },
      { kind: 'local-app-data', path: env && env.LocalAppData ? path.join(env.LocalAppData, 'Programs', 'nodejs', 'node.exe') : null },
      { kind: 'volta', path: env && env.LocalAppData ? path.join(env.LocalAppData, 'Volta', 'bin', 'node.exe') : null }
    ];

    for (const candidate of candidateSpecs) {
      if (candidate.path && fs.existsSync(candidate.path)) {
        return { ready: true, kind: candidate.kind, path: candidate.path };
      }
    }
  }

  return {
    ready: false,
    kind: 'missing',
    path: null
  };
}

function renderVsCodeLauncher() {
  const slashSpecsJson = JSON.stringify(getSlashActionSpecs());
  return [
    '#!/usr/bin/env node',
    '\'use strict\';',
    '',
    'const fs = require(\'fs\');',
    'const path = require(\'path\');',
    'const { spawnSync } = require(\'child_process\');',
    '',
    'const PROJECT_ROOT = path.resolve(__dirname, \'..\');',
    'const RAW_ARGS = process.argv.slice(2);',
    'const ACTION = RAW_ARGS[0] || \'explain\';',
    `const SLASH_ACTIONS = ${slashSpecsJson};`,
    'const SLASH_ROOT_ALIASES = new Set([\'/road\', \'/roadmap-sync\']);',
    'const DIRECT_SLASH_ALIAS_TO_ACTION = {',
    '  \'/zero\': \'zero\',',
    '  \'/maintain\': \'maintain\',',
    '  \'/status\': \'status\',',
    '  \'/init\': \'init\',',
    '  \'/generate\': \'generate\',',
    '  \'/validate\': \'validate\',',
    '  \'/sync\': \'sync\',',
    '  \'/audit\': \'audit\',',
    '  \'/setup\': \'setup\'',
    '};',
    'const LOCAL_DEV_CLI = path.join(PROJECT_ROOT, \'roadmap-skill\', \'bin\', \'cli.js\');',
    'const LOCAL_PACKAGE_CLI = path.join(PROJECT_ROOT, \'node_modules\', \'roadmapsmith\', \'bin\', \'cli.js\');',
    '',
    'function candidate(kind, cliPath) {',
    '  return { kind, execPath: process.execPath, prefixArgs: [cliPath], shell: false, displayPath: cliPath };',
    '}',
    '',
    'function findGlobalCommandPath() {',
    '  const probe = process.platform === \'win32\'',
    '    ? spawnSync(\'where\', [\'roadmapsmith\'], { encoding: \'utf8\' })',
    '    : spawnSync(\'which\', [\'roadmapsmith\'], { encoding: \'utf8\' });',
    '  if (probe.status !== 0 || !probe.stdout) {',
    '    return null;',
    '  }',
    '  const firstLine = probe.stdout.split(/\\r?\\n/).map((line) => line.trim()).find(Boolean);',
    '  return firstLine || null;',
    '}',
    '',
    'function resolveCli() {',
    '  if (fs.existsSync(LOCAL_DEV_CLI)) {',
    '    return candidate(\'workspace-dev-copy\', LOCAL_DEV_CLI);',
    '  }',
    '  if (fs.existsSync(LOCAL_PACKAGE_CLI)) {',
    '    return candidate(\'workspace-dependency\', LOCAL_PACKAGE_CLI);',
    '  }',
    '  const globalPath = findGlobalCommandPath();',
    '  if (globalPath) {',
    '    return { kind: \'global\', execPath: globalPath, prefixArgs: [], shell: process.platform === \'win32\', displayPath: globalPath };',
    '  }',
    '  return null;',
    '}',
    '',
    'function normalizeActionId(value) {',
    '  return String(value || \'\').trim().toLowerCase().replace(/^\\/+/g, \'\');',
    '}',
    '',
    'function getSlashSuggestions(query) {',
    '  const normalized = normalizeActionId(query);',
    '  if (!normalized) {',
    '    return SLASH_ACTIONS.slice();',
    '  }',
    '  const startsWithMatches = SLASH_ACTIONS.filter((action) => action.id.startsWith(normalized));',
    '  const containsMatches = SLASH_ACTIONS.filter((action) => !action.id.startsWith(normalized) && action.id.includes(normalized));',
    '  return [...startsWithMatches, ...containsMatches];',
    '}',
    '',
    'function renderSlashPalette(route) {',
    '  const source = route && route.source ? route.source : \'/road\';',
    '  const query = normalizeActionId(route && route.query);',
    '  const suggestions = route && Array.isArray(route.suggestions) ? route.suggestions : getSlashSuggestions(query);',
    '  const lines = [];',
    '  lines.push(\'RoadmapSmith slash palette\');',
    '  lines.push(\'\');',
    '  if (query) {',
    '    lines.push(`Input: ${source} ${query}`);',
    '    lines.push(suggestions.length > 0 ? \'No exact slash match was executed. Related actions:\' : \'No exact slash match was executed.\');',
    '  } else {',
    '    lines.push(`Entry point: ${source}`);',
    '    lines.push(\'Use an exact slash action to execute work. Incomplete or ambiguous input only shows suggestions.\');',
    '  }',
    '  lines.push(\'\');',
    '  if (suggestions.length === 0) {',
    '    lines.push(\'No related slash actions found.\');',
    '  } else {',
    '    suggestions.forEach((action) => {',
    '      lines.push(`- /${action.id}: ${action.description}`);',
    '      lines.push(`  Classic CLI: ${action.classicCliExample}`);',
    '      lines.push(`  Skill form: /roadmap-sync ${action.id}`);',
    '      lines.push(`  VS Code task: ${action.taskLabel}`);',
    '    });',
    '  }',
    '  lines.push(\'\');',
    '  lines.push(\'Examples:\');',
    '  lines.push(\'- roadmapsmith zero\');',
    '  lines.push(\'- roadmapsmith maintain\');',
    '  lines.push(\'- roadmapsmith /road\');',
    '  lines.push(\'- roadmapsmith /maintain\');',
    '  lines.push(\'- roadmapsmith /roadmap-sync maintain\');',
    '  lines.push(\'\');',
    '  lines.push(\'Installing the skill alone does not expose CLI behavior in VS Code. Use roadmapsmith setup for the visible task/launcher layer.\');',
    '  return lines.join(\'\\n\');',
    '}',
    '',
    'function resolveSlashInvocation(command, args) {',
    '  if (typeof command !== \'string\' || !command.trim().startsWith(\'/\')) {',
    '    return null;',
    '  }',
    '  const normalizedCommand = command.trim().toLowerCase();',
    '  if (Object.prototype.hasOwnProperty.call(DIRECT_SLASH_ALIAS_TO_ACTION, normalizedCommand)) {',
    '    return {',
    '      kind: \'execute\',',
    '      actionId: DIRECT_SLASH_ALIAS_TO_ACTION[normalizedCommand],',
    '      query: normalizeActionId(normalizedCommand),',
    '      source: normalizedCommand,',
    '      suggestions: getSlashSuggestions(normalizedCommand)',
    '    };',
    '  }',
    '  if (SLASH_ROOT_ALIASES.has(normalizedCommand)) {',
    '    const queryToken = args.length > 0 ? normalizeActionId(args[0]) : \'\';',
    '    if (!queryToken) {',
    '      return { kind: \'palette\', query: \'\', source: normalizedCommand, suggestions: getSlashSuggestions(\'\') };',
    '    }',
    '    const exactAction = SLASH_ACTIONS.find((action) => action.id === queryToken);',
    '    if (exactAction) {',
    '      return { kind: \'execute\', actionId: exactAction.id, query: queryToken, source: normalizedCommand, suggestions: getSlashSuggestions(queryToken) };',
    '    }',
    '    return { kind: \'palette\', query: queryToken, source: normalizedCommand, suggestions: getSlashSuggestions(queryToken) };',
    '  }',
    '  return { kind: \'palette\', query: normalizeActionId(normalizedCommand), source: normalizedCommand, suggestions: getSlashSuggestions(normalizedCommand) };',
    '}',
    '',
    'function explain() {',
    '  console.log(\'RoadmapSmith layers:\\n\');',
    '  console.log(\'1. The roadmap-sync skill guides the agent. It does not add VS Code buttons or install the CLI.\');',
    '  console.log(\'2. The roadmapsmith CLI executes zero/maintain plus the lower-level init/generate/validate/sync/setup/doctor commands.\');',
    '  console.log(\'3. roadmapsmith setup makes the CLI visible in VS Code through tasks and optional Claude hook wiring.\\n\');',
    '  console.log(\'Typical VS Code workflow:\');',
    '  console.log(\'- Run "RoadmapSmith: Status" to inspect readiness.\');',
    '  console.log(\'- For empty repos, run "RoadmapSmith: Zero Mode" or use "/road zero".\');',
    '  console.log(\'- For existing repos, run "RoadmapSmith: Maintain" or use "/road maintain".\');',
    '  console.log(\'- Use the lower-level Init, Generate, Validate, and Sync tasks only when you want manual control.\\n\');',
    '  console.log(\'If you installed only the skill, install the CLI as well and then run "RoadmapSmith: Refresh Setup".\');',
    '}',
    '',
    'function printStatusFromDoctor(payload) {',
    '  console.log(\'RoadmapSmith status\\n\');',
    '  if (!payload || !payload.cli || !payload.vscode || !payload.hosts) {',
    '    console.log(\'Doctor could not inspect the full host setup. Raw payload follows:\\n\');',
    '    console.log(JSON.stringify(payload, null, 2));',
    '    return;',
    '  }',
    '  console.log(`Project root: ${payload.projectRoot}`);',
    '  console.log(`CLI resolution: ${payload.cli.kind}${payload.cli.path ? ` (${payload.cli.path})` : \'\'}${payload.cli.ready ? \'\' : \' [missing]\'}`);',
    '  console.log(`Roadmap file: ${payload.roadmap.exists ? \'ready\' : \'missing\'} (${payload.roadmap.path})`);',
    '  console.log(`Agent rules: ${payload.agents.exists ? \'ready\' : \'missing\'} (${payload.agents.path})`);',
    '  console.log(`VS Code launcher: ${payload.vscode.launcher.exists ? \'ready\' : \'missing\'} (${payload.vscode.launcher.path})`);',
    '  console.log(`VS Code task wrappers: ${payload.vscode.wrappers.ready ? \'ready\' : \'incomplete\'} (${payload.vscode.wrappers.presentCount}/${payload.vscode.wrappers.expectedCount} files)`);',
    '  console.log(`VS Code tasks: ${payload.vscode.tasks.ready ? \'ready\' : \'incomplete\'} (${payload.vscode.tasks.presentLabels.length}/${payload.vscode.tasks.expectedLabels.length} tasks)`);',
    '  console.log(`Node runtime: ${payload.runtime.ready ? `ready (${payload.runtime.kind}${payload.runtime.path ? `: ${payload.runtime.path}` : \'\'})` : \'missing\'}`);',
    '  if (!payload.vscode.tasks.ready && payload.vscode.tasks.missingLabels.length > 0) {',
    '    console.log(`Missing VS Code tasks: ${payload.vscode.tasks.missingLabels.join(\', \')}`);',
    '  }',
    '  if (!payload.vscode.wrappers.ready) {',
    '    console.log(`Missing task wrapper files: ${payload.vscode.wrappers.missingPaths.join(\', \')}`);',
    '  }',
    '  console.log(`Codex readiness: ${payload.hosts.codex.ready ? \'ready\' : \'needs setup\'} (${payload.hosts.codex.message})`);',
    '  console.log(`Claude readiness: ${payload.hosts.claude.ready ? \'ready\' : \'needs setup\'} (${payload.hosts.claude.message})`);',
    '  if (!payload.cli.ready) {',
    '    console.log(\'\\nThe CLI is missing. Installing the skill alone does not expose RoadmapSmith actions in VS Code.\');',
    '    console.log(\'Install the CLI, then run "RoadmapSmith: Refresh Setup".\');',
    '  }',
    '  if (!payload.runtime.ready) {',
    '    console.log(\'\\nThe VS Code task runtime is missing. Install Node.js or set ROADMAPSMITH_NODE, then rerun "RoadmapSmith: Status".\');',
    '  }',
    '  console.log(\'\\nRecommended entrypoints: roadmapsmith zero, roadmapsmith maintain\');',
    '  console.log(\'Slash entrypoints: /road, /zero, /maintain, /status, /generate, /validate, /sync, /audit, /setup, /roadmap-sync <action>\');',
    '}',
    '',
    'function printMissingCliStatus() {',
    '  console.log(\'RoadmapSmith status\\n\');',
    '  console.log(`Project root: ${PROJECT_ROOT}`);',
    '  console.log(\'CLI resolution: missing\');',
    '  console.log(\'VS Code tasks are visible because setup generated this launcher, but no RoadmapSmith CLI could be resolved.\');',
    '  console.log(\'Installing the skill alone does not expose the CLI in VS Code.\');',
    '  console.log(\'Install the roadmapsmith package, then run "RoadmapSmith: Refresh Setup".\');',
    '  console.log(\'The launcher looks for, in order: workspace dev copy, workspace dependency, global command.\');',
    '  console.log(\'Slash discovery still works here: try /road for the local palette.\');',
    '}',
    '',
    'function runCli(args, options = {}) {',
    '  const resolution = resolveCli();',
    '  if (!resolution) {',
    '    if (options.allowMissingCli) {',
    '      return { status: 0, stdout: \'\', stderr: \'\', missingCli: true };',
    '    }',
    '    console.error(\'RoadmapSmith CLI not found. Install the CLI and rerun setup.\');',
    '    process.exitCode = 1;',
    '    return null;',
    '  }',
    '  const result = spawnSync(resolution.execPath, [...resolution.prefixArgs, ...args], {',
    '    cwd: PROJECT_ROOT,',
    '    encoding: \'utf8\',',
    '    shell: resolution.shell,',
    '    stdio: options.capture ? \'pipe\' : \'inherit\'',
    '  });',
    '  return { ...result, resolution };',
    '}',
    '',
    'function forwardResult(result) {',
    '  if (!result) {',
    '    return;',
    '  }',
    '  if (typeof result.status === \'number\' && result.status !== 0) {',
    '    process.exitCode = result.status;',
    '  }',
    '}',
    '',
    'function status() {',
    '  const result = runCli([\'doctor\', \'--project-root\', PROJECT_ROOT, \'--json\'], { capture: true, allowMissingCli: true });',
    '  if (!result || result.missingCli) {',
    '    printMissingCliStatus();',
    '    return;',
    '  }',
    '  if (result.stdout) {',
    '    try {',
    '      printStatusFromDoctor(JSON.parse(result.stdout));',
    '      return;',
    '    } catch (_) {}',
    '  }',
    '  if (result.stdout) process.stdout.write(result.stdout);',
    '  if (result.stderr) process.stderr.write(result.stderr);',
    '  process.exitCode = 0;',
    '}',
    '',
    'const actionToCliArgs = {',
    '  zero: [\'zero\', \'--project-root\', PROJECT_ROOT],',
    '  maintain: [\'maintain\', \'--project-root\', PROJECT_ROOT],',
    '  init: [\'init\'],',
    '  generate: [\'generate\', \'--project-root\', PROJECT_ROOT],',
    '  validate: [\'validate\', \'--json\', \'--project-root\', PROJECT_ROOT],',
    '  sync: [\'sync\', \'--project-root\', PROJECT_ROOT],',
    '  audit: [\'sync\', \'--audit\', \'--project-root\', PROJECT_ROOT],',
    '  \'sync-dry-run\': [\'sync\', \'--dry-run\', \'--project-root\', PROJECT_ROOT],',
    '  \'sync-audit\': [\'sync\', \'--audit\', \'--project-root\', PROJECT_ROOT],',
    '  setup: [\'setup\', \'--project-root\', PROJECT_ROOT]',
    '};',
    '',
    'const slashInvocation = resolveSlashInvocation(ACTION, RAW_ARGS.slice(1));',
    '',
    'if (slashInvocation) {',
    '  if (slashInvocation.kind === \'palette\') {',
    '    console.log(renderSlashPalette(slashInvocation));',
    '  } else if (slashInvocation.actionId === \'status\') {',
    '    status();',
    '  } else if (Object.prototype.hasOwnProperty.call(actionToCliArgs, slashInvocation.actionId)) {',
    '    const result = runCli(actionToCliArgs[slashInvocation.actionId]);',
    '    forwardResult(result);',
    '  } else {',
    '    console.log(renderSlashPalette(slashInvocation));',
    '  }',
    '} else if (ACTION === \'explain\') {',
    '  explain();',
    '} else if (ACTION === \'status\') {',
    '  status();',
    '} else if (Object.prototype.hasOwnProperty.call(actionToCliArgs, ACTION)) {',
    '  const result = runCli(actionToCliArgs[ACTION]);',
    '  forwardResult(result);',
    '} else {',
    '  console.error(`Unknown RoadmapSmith launcher action: ${ACTION}`);',
    '  process.exitCode = 1;',
    '}',
    ''
  ].join('\n');
}

function buildSetupFiles(projectRoot, options = {}) {
  const editor = assertSupportedEditor(options.editor);
  const hosts = parseHosts(options.hosts);
  if (editor !== 'vscode') {
    throw new Error(`Unsupported editor "${editor}"`);
  }

  const vscodeTasksPath = path.join(projectRoot, '.vscode', 'tasks.json');
  const vscodeLauncherPath = path.join(projectRoot, VSCODE_LAUNCHER_RELATIVE_PATH);
  const windowsTaskWrapperPath = path.join(projectRoot, WINDOWS_TASK_WRAPPER_RELATIVE_PATH);
  const posixTaskWrapperPath = path.join(projectRoot, POSIX_TASK_WRAPPER_RELATIVE_PATH);
  const files = [
    {
      path: vscodeTasksPath,
      content: stringifyJson(mergeVsCodeTasks(readJsoncObject(vscodeTasksPath)))
    },
    {
      path: vscodeLauncherPath,
      content: renderVsCodeLauncher()
    },
    {
      path: windowsTaskWrapperPath,
      content: renderWindowsTaskWrapper()
    },
    {
      path: posixTaskWrapperPath,
      content: renderPosixTaskWrapper()
    }
  ];

  if (hosts.includes('claude')) {
    const claudeSettingsPath = path.join(projectRoot, '.claude', 'settings.json');
    const claudeHookPath = path.join(projectRoot, CLAUDE_HOOK_RELATIVE_PATH);
    files.push({
      path: claudeSettingsPath,
      content: stringifyJson(mergeClaudeSettings(readJsoncObject(claudeSettingsPath)))
    });
    files.push({
      path: claudeHookPath,
      content: renderClaudeHookScript()
    });
  }

  return {
    editor,
    hosts,
    files
  };
}

function applySetupFiles(setupPlan, options = {}) {
  return setupPlan.files.map((file) => {
    return writeText(file.path, file.content, { dryRun: options.dryRun });
  });
}

function findGlobalRoadmapsmith() {
  const probe = process.platform === 'win32'
    ? require('child_process').spawnSync('where', ['roadmapsmith'], { encoding: 'utf8' })
    : require('child_process').spawnSync('which', ['roadmapsmith'], { encoding: 'utf8' });
  if (probe.status !== 0 || !probe.stdout) {
    return null;
  }
  return probe.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || null;
}

function detectCliResolution(projectRoot) {
  const workspaceDevCli = path.join(projectRoot, 'roadmap-skill', 'bin', 'cli.js');
  if (fs.existsSync(workspaceDevCli)) {
    return {
      ready: true,
      kind: 'workspace-dev-copy',
      path: workspaceDevCli
    };
  }

  const workspaceDependencyCli = path.join(projectRoot, 'node_modules', 'roadmapsmith', 'bin', 'cli.js');
  if (fs.existsSync(workspaceDependencyCli)) {
    return {
      ready: true,
      kind: 'workspace-dependency',
      path: workspaceDependencyCli
    };
  }

  const globalCommandPath = findGlobalRoadmapsmith();
  if (globalCommandPath) {
    return {
      ready: true,
      kind: 'global',
      path: globalCommandPath
    };
  }

  return {
    ready: false,
    kind: 'missing',
    path: null
  };
}

function inspectVsCodeTasks(projectRoot) {
  const tasksPath = path.join(projectRoot, '.vscode', 'tasks.json');
  const launcherPath = path.join(projectRoot, VSCODE_LAUNCHER_RELATIVE_PATH);
  const windowsWrapperPath = path.join(projectRoot, WINDOWS_TASK_WRAPPER_RELATIVE_PATH);
  const posixWrapperPath = path.join(projectRoot, POSIX_TASK_WRAPPER_RELATIVE_PATH);
  const tasksConfig = readJsoncObject(tasksPath);
  const tasks = Array.isArray(tasksConfig && tasksConfig.tasks) ? tasksConfig.tasks : [];
  const presentLabels = tasks.map((task) => task && task.label).filter(Boolean);
  const presentManagedLabels = ROADMAPSMITH_TASK_LABELS.filter((label) => presentLabels.includes(label));
  const wrapperEntries = [
    { path: windowsWrapperPath, exists: fs.existsSync(windowsWrapperPath) },
    { path: posixWrapperPath, exists: fs.existsSync(posixWrapperPath) }
  ];
  const presentWrappers = wrapperEntries.filter((entry) => entry.exists);

  return {
    launcher: {
      path: launcherPath,
      exists: fs.existsSync(launcherPath)
    },
    wrappers: {
      expectedCount: wrapperEntries.length,
      presentCount: presentWrappers.length,
      ready: wrapperEntries.every((entry) => entry.exists),
      windows: wrapperEntries[0],
      posix: wrapperEntries[1],
      missingPaths: wrapperEntries.filter((entry) => !entry.exists).map((entry) => entry.path)
    },
    tasks: {
      path: tasksPath,
      exists: tasksConfig != null,
      ready: ROADMAPSMITH_TASK_LABELS.every((label) => presentLabels.includes(label)) && fs.existsSync(launcherPath) && wrapperEntries.every((entry) => entry.exists),
      expectedLabels: ROADMAPSMITH_TASK_LABELS.slice(),
      presentLabels: presentManagedLabels,
      missingLabels: ROADMAPSMITH_TASK_LABELS.filter((label) => !presentLabels.includes(label))
    }
  };
}

function inspectClaudeSetup(projectRoot) {
  const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
  const hookPath = path.join(projectRoot, CLAUDE_HOOK_RELATIVE_PATH);
  const settings = readJsoncObject(settingsPath);
  const postToolUse = Array.isArray(settings && settings.hooks && settings.hooks.PostToolUse)
    ? settings.hooks.PostToolUse
    : [];
  const configured = postToolUse.some((entry) => isRoadmapSmithHookEntry(entry));

  return {
    settings: {
      path: settingsPath,
      exists: settings != null
    },
    hookFile: {
      path: hookPath,
      exists: fs.existsSync(hookPath)
    },
    configured,
    ready: configured && fs.existsSync(hookPath)
  };
}

function inspectHostSetup(projectRoot, options = {}) {
  const roadmapFile = options.roadmapFile;
  const agentsFile = options.agentsFile;
  const runtime = detectNodeRuntime(options.env || process.env);
  const cli = detectCliResolution(projectRoot);
  const vscode = inspectVsCodeTasks(projectRoot);
  const claude = inspectClaudeSetup(projectRoot);
  const codexReady = cli.ready && vscode.tasks.ready && runtime.ready;
  let codexMessage = 'VS Code tasks are ready for Codex/manual host workflows';
  if (!cli.ready) {
    codexMessage = 'Install the RoadmapSmith CLI and rerun setup';
  } else if (!vscode.tasks.ready) {
    codexMessage = 'Run roadmapsmith setup to regenerate the VS Code task surface';
  } else if (!runtime.ready) {
    codexMessage = 'Install Node.js or set ROADMAPSMITH_NODE so VS Code tasks can launch the wrapper';
  }

  return {
    projectRoot,
    cli,
    runtime,
    roadmap: {
      path: roadmapFile,
      exists: roadmapFile ? fs.existsSync(roadmapFile) : false
    },
    agents: {
      path: agentsFile,
      exists: agentsFile ? fs.existsSync(agentsFile) : false
    },
    vscode,
    claude,
    hosts: {
      codex: {
        ready: codexReady,
        message: codexMessage
      },
      claude: {
        ready: cli.ready && claude.ready,
        message: cli.ready && claude.ready
          ? 'Claude PostToolUse hook is configured'
          : 'Run roadmapsmith setup with the claude host and verify node is available to Claude'
      }
    }
  };
}

module.exports = {
  CLAUDE_HOOK_COMMAND,
  ROADMAPSMITH_TASK_LABELS,
  applySetupFiles,
  assertSupportedEditor,
  buildSetupFiles,
  detectNodeRuntime,
  detectCliResolution,
  inspectHostSetup,
  mergeClaudeSettings,
  mergeVsCodeTasks,
  parseHosts,
  parseJsonc,
  readJsoncObject,
  renderClaudeHookScript,
  renderPosixTaskWrapper,
  renderVsCodeLauncher,
  renderWindowsTaskWrapper,
  stringifyJson
};
