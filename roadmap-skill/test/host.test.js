'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildSetupFiles,
  detectNodeRuntime,
  inspectHostSetup,
  mergeClaudeSettings,
  mergeVsCodeTasks,
  parseHosts,
  parseJsonc,
  ROADMAPSMITH_TASK_LABELS
} = require('../src/host');

test('parseHosts defaults to codex and claude', () => {
  assert.deepEqual(parseHosts(), ['codex', 'claude']);
});

test('parseHosts rejects unsupported hosts', () => {
  assert.throws(() => parseHosts('claude,figma'), /Unsupported host/);
});

test('parseJsonc handles comments and trailing commas', () => {
  const parsed = parseJsonc([
    '{',
    '  // comment',
    '  "version": "2.0.0",',
    '  "tasks": [',
    '    { "label": "One", },',
    '  ],',
    '}'
  ].join('\n'), 'tasks.json');

  assert.equal(parsed.version, '2.0.0');
  assert.equal(parsed.tasks[0].label, 'One');
});

test('mergeVsCodeTasks preserves unrelated tasks and replaces managed labels', () => {
  const merged = mergeVsCodeTasks({
    version: '2.0.0',
    tasks: [
      { label: 'RoadmapSmith: Status', type: 'shell', command: 'old' },
      { label: 'Custom Task', type: 'shell', command: 'echo custom' }
    ]
  });

  assert.deepEqual(merged.tasks.slice(0, ROADMAPSMITH_TASK_LABELS.length).map((task) => task.label), ROADMAPSMITH_TASK_LABELS);
  assert.equal(merged.tasks.some((task) => task.label === 'Custom Task'), true);
  assert.equal(merged.tasks.filter((task) => task.label === 'RoadmapSmith: Status').length, 1);
  assert.equal(merged.tasks[0].type, 'process');
  assert.equal(merged.tasks[0].command, 'sh');
  assert.deepEqual(merged.tasks[0].args, ['.vscode/roadmapsmith-task.sh', 'zero']);
  assert.equal(merged.tasks[0].windows.command, 'cmd.exe');
  assert.deepEqual(merged.tasks[0].windows.args, ['/d', '/c', '.vscode\\roadmapsmith-task.cmd', 'zero']);
});

test('mergeClaudeSettings preserves unrelated hooks and replaces roadmapsmith hook', () => {
  const merged = mergeClaudeSettings({
    hooks: {
      PostToolUse: [
        {
          matcher: 'Write',
          hooks: [{ type: 'command', command: 'node .claude/hooks/custom.js' }]
        },
        {
          matcher: 'Write|Edit|MultiEdit',
          hooks: [{ type: 'command', command: 'node .claude/hooks/roadmap-sync.js', timeout: 10 }]
        }
      ]
    }
  });

  assert.equal(merged.hooks.PostToolUse.some((entry) => entry.hooks.some((hook) => hook.command === 'node .claude/hooks/custom.js')), true);
  assert.equal(merged.hooks.PostToolUse.filter((entry) => entry.hooks.some((hook) => hook.command === 'node .claude/hooks/roadmap-sync.js')).length, 1);
  assert.equal(merged.hooks.PostToolUse[0].hooks[0].timeout, 30);
});

test('buildSetupFiles can target codex only without generating claude files', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-host-build-'));
  const setupPlan = buildSetupFiles(projectRoot, { editor: 'vscode', hosts: 'codex' });
  const plannedPaths = setupPlan.files.map((file) => path.relative(projectRoot, file.path).replace(/\\/g, '/'));

  assert.deepEqual(setupPlan.hosts, ['codex']);
  assert.equal(plannedPaths.includes('.vscode/tasks.json'), true);
  assert.equal(plannedPaths.includes('.vscode/roadmapsmith-launcher.js'), true);
  assert.equal(plannedPaths.includes('.vscode/roadmapsmith-task.cmd'), true);
  assert.equal(plannedPaths.includes('.vscode/roadmapsmith-task.sh'), true);
  assert.equal(plannedPaths.some((plannedPath) => plannedPath.startsWith('.claude/')), false);
});

test('detectNodeRuntime accepts an explicit ROADMAPSMITH_NODE override', () => {
  const runtime = detectNodeRuntime({
    ...process.env,
    ROADMAPSMITH_NODE: process.execPath
  });

  assert.equal(runtime.ready, true);
  assert.equal(runtime.kind, 'env-override');
  assert.equal(runtime.path, process.execPath);
});

test('inspectHostSetup downgrades Codex readiness when task runtime is missing', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-host-runtime-missing-'));
  fs.mkdirSync(path.join(projectRoot, '.vscode'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, '.claude', 'hooks'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'roadmap-skill', 'bin'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, '.vscode', 'tasks.json'), JSON.stringify(mergeVsCodeTasks({ version: '2.0.0', tasks: [] }), null, 2));
  fs.writeFileSync(path.join(projectRoot, '.vscode', 'roadmapsmith-launcher.js'), '\'use strict\';\n');
  fs.writeFileSync(path.join(projectRoot, '.vscode', 'roadmapsmith-task.cmd'), '@echo off\r\n', 'utf8');
  fs.writeFileSync(path.join(projectRoot, '.vscode', 'roadmapsmith-task.sh'), '#!/bin/sh\n', 'utf8');
  fs.writeFileSync(path.join(projectRoot, '.claude', 'settings.json'), JSON.stringify(mergeClaudeSettings({}), null, 2));
  fs.writeFileSync(path.join(projectRoot, '.claude', 'hooks', 'roadmap-sync.js'), '\'use strict\';\n');
  fs.writeFileSync(path.join(projectRoot, 'roadmap-skill', 'bin', 'cli.js'), '\'use strict\';\n');
  fs.writeFileSync(path.join(projectRoot, 'ROADMAP.md'), '# roadmap\n', 'utf8');
  fs.writeFileSync(path.join(projectRoot, 'AGENTS.md'), '# agents\n', 'utf8');

  const emptyRuntimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-empty-runtime-'));
  const hostStatus = inspectHostSetup(projectRoot, {
    roadmapFile: path.join(projectRoot, 'ROADMAP.md'),
    agentsFile: path.join(projectRoot, 'AGENTS.md'),
    env: {
      PATH: '',
      ROADMAPSMITH_NODE: '',
      ProgramFiles: emptyRuntimeRoot,
      'ProgramFiles(x86)': emptyRuntimeRoot,
      LocalAppData: emptyRuntimeRoot
    }
  });

  assert.equal(hostStatus.vscode.tasks.ready, true);
  assert.equal(hostStatus.runtime.ready, false);
  assert.equal(hostStatus.hosts.codex.ready, false);
  assert.equal(hostStatus.hosts.claude.ready, true);
});
