'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const CLI = path.resolve(__dirname, '..', 'bin', 'cli.js');
const LAUNCHER = path.resolve(__dirname, '..', '..', '.vscode', 'roadmapsmith-launcher.js');
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CANONICAL_ROADMAP = 'ROADMAP.md';
const LEGACY_ROADMAP = 'roadmap.md';
const CASE_DISTINCT_ROADMAP_FILES = supportsCaseDistinctRoadmapFiles();
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

function run(args, cwd) {
  return execFileSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8'
  });
}

function runResult(args, cwd, options = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    env: options.env || process.env
  });
}

function runLauncherResult(args, cwd, options = {}) {
  return spawnSync(process.execPath, [LAUNCHER, ...args], {
    cwd,
    encoding: 'utf8',
    env: options.env || process.env
  });
}

function runWrapperResult(projectRoot, action, options = {}) {
  const env = options.env || process.env;
  if (process.platform === 'win32') {
    const command = env.ComSpec || path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'cmd.exe');
    return spawnSync(command, ['/d', '/c', path.join(projectRoot, '.vscode', 'roadmapsmith-task.cmd'), action], {
      cwd: projectRoot,
      encoding: 'utf8',
      env
    });
  }

  return spawnSync('/bin/sh', [path.join(projectRoot, '.vscode', 'roadmapsmith-task.sh'), action], {
    cwd: projectRoot,
    encoding: 'utf8',
    env
  });
}

function buildNoCliEnv() {
  const env = { ...process.env };
  delete env.ROADMAPSMITH_NODE;
  env.PATH = '';
  return env;
}

function writePackageJson(projectRoot) {
  fs.writeFileSync(path.join(projectRoot, 'package.json'), JSON.stringify({ name: 'x', version: '1.0.0' }, null, 2));
}

function setupFixture(name) {
  const source = path.resolve(__dirname, 'fixtures', name);
  const target = fs.mkdtempSync(path.join(os.tmpdir(), `roadmap-skill-cli-${name}-`));
  fs.cpSync(source, target, { recursive: true });
  return target;
}

function writeWorkspaceCliShim(projectRoot) {
  const cliShimPath = path.join(projectRoot, 'roadmap-skill', 'bin', 'cli.js');
  fs.mkdirSync(path.dirname(cliShimPath), { recursive: true });
  fs.writeFileSync(
    cliShimPath,
    [
      '\'use strict\';',
      `require(${JSON.stringify(CLI)});`,
      ''
    ].join('\n'),
    'utf8'
  );
}

function hasEntry(projectRoot, fileName) {
  return fs.readdirSync(projectRoot).includes(fileName);
}

function supportsCaseDistinctRoadmapFiles() {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-case-check-'));
  try {
    fs.writeFileSync(path.join(projectRoot, LEGACY_ROADMAP), '# legacy\n', 'utf8');
    fs.writeFileSync(path.join(projectRoot, CANONICAL_ROADMAP), '# canonical\n', 'utf8');
    const entries = fs.readdirSync(projectRoot);
    return entries.includes(LEGACY_ROADMAP) && entries.includes(CANONICAL_ROADMAP);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
}

test('cli init creates roadmap and agents files', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-init-'));
  run(['init'], projectRoot);

  const roadmap = path.join(projectRoot, CANONICAL_ROADMAP);
  const agents = path.join(projectRoot, 'AGENTS.md');
  assert.equal(hasEntry(projectRoot, CANONICAL_ROADMAP), true);
  assert.equal(fs.existsSync(roadmap), true);
  assert.equal(fs.existsSync(agents), true);
});

test('cli setup creates VS Code and Claude integration files', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-setup-'));

  run(['setup'], projectRoot);

  const tasksPath = path.join(projectRoot, '.vscode', 'tasks.json');
  const launcherPath = path.join(projectRoot, '.vscode', 'roadmapsmith-launcher.js');
  const windowsTaskWrapperPath = path.join(projectRoot, '.vscode', 'roadmapsmith-task.cmd');
  const posixTaskWrapperPath = path.join(projectRoot, '.vscode', 'roadmapsmith-task.sh');
  const claudeSettingsPath = path.join(projectRoot, '.claude', 'settings.json');
  const claudeHookPath = path.join(projectRoot, '.claude', 'hooks', 'roadmap-sync.js');
  const tasksConfig = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
  const taskLabels = tasksConfig.tasks.map((task) => task.label);

  assert.equal(fs.existsSync(launcherPath), true);
  assert.equal(fs.existsSync(windowsTaskWrapperPath), true);
  assert.equal(fs.existsSync(posixTaskWrapperPath), true);
  assert.equal(fs.existsSync(claudeSettingsPath), true);
  assert.equal(fs.existsSync(claudeHookPath), true);
  assert.deepEqual(taskLabels.slice(0, ROADMAPSMITH_TASK_LABELS.length), ROADMAPSMITH_TASK_LABELS);
  assert.equal(tasksConfig.tasks[0].command, 'sh');
  assert.equal(tasksConfig.tasks[0].windows.command, 'cmd.exe');
  assert.deepEqual(tasksConfig.tasks[0].args, ['.vscode/roadmapsmith-task.sh', 'zero']);
});

test('cli setup dry-run does not modify files', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-setup-dry-run-'));

  const out = run(['setup', '--dry-run'], projectRoot);
  const vscodeDir = path.join(projectRoot, '.vscode');
  const claudeDir = path.join(projectRoot, '.claude');

  assert.match(out, /Would create .*tasks\.json/);
  assert.equal(fs.existsSync(vscodeDir), false);
  assert.equal(fs.existsSync(claudeDir), false);
});

test('cli setup is idempotent on repeated runs', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-setup-idempotent-'));

  run(['setup'], projectRoot);
  const firstTasks = fs.readFileSync(path.join(projectRoot, '.vscode', 'tasks.json'), 'utf8');
  const secondRun = run(['setup'], projectRoot);
  const secondTasks = fs.readFileSync(path.join(projectRoot, '.vscode', 'tasks.json'), 'utf8');

  assert.equal(secondTasks, firstTasks);
  assert.match(secondRun, /No changes for .*tasks\.json/);
});

test('cli setup preserves unrelated VS Code tasks and Claude hooks', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-setup-merge-'));
  fs.mkdirSync(path.join(projectRoot, '.vscode'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, '.claude', 'hooks'), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, '.vscode', 'tasks.json'),
    [
      '{',
      '  // Existing JSONC comment should survive parsing',
      '  "version": "2.0.0",',
      '  "tasks": [',
      '    { "label": "Custom Task", "type": "shell", "command": "echo custom" },',
      '  ]',
      '}'
    ].join('\n'),
    'utf8'
  );
  fs.writeFileSync(
    path.join(projectRoot, '.claude', 'settings.json'),
    JSON.stringify({
      hooks: {
        PostToolUse: [
          {
            matcher: 'Write',
            hooks: [{ type: 'command', command: 'node .claude/hooks/custom.js' }]
          }
        ]
      }
    }, null, 2),
    'utf8'
  );

  run(['setup'], projectRoot);

  const tasksConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, '.vscode', 'tasks.json'), 'utf8'));
  const settingsConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, '.claude', 'settings.json'), 'utf8'));
  const taskLabels = tasksConfig.tasks.map((task) => task.label);
  const postToolUse = settingsConfig.hooks.PostToolUse;

  assert.ok(taskLabels.includes('Custom Task'));
  assert.ok(taskLabels.includes('RoadmapSmith: Status'));
  assert.equal(postToolUse.some((entry) => entry.hooks.some((hook) => hook.command === 'node .claude/hooks/custom.js')), true);
  assert.equal(postToolUse.some((entry) => entry.hooks.some((hook) => hook.command === 'node .claude/hooks/roadmap-sync.js')), true);
});

test('cli setup fails on invalid existing config without partial writes', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-setup-invalid-'));
  fs.mkdirSync(path.join(projectRoot, '.vscode'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, '.vscode', 'tasks.json'), '{ invalid json', 'utf8');

  const result = runResult(['setup'], projectRoot);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid JSON/);
  assert.equal(fs.existsSync(path.join(projectRoot, '.vscode', 'roadmapsmith-launcher.js')), false);
  assert.equal(fs.existsSync(path.join(projectRoot, '.claude')), false);
});

test('cli generate writes managed roadmap content', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-generate-'));
  writePackageJson(projectRoot);
  fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'src', 'index.js'), 'function main() { return true; }\n', 'utf8');

  run(['generate'], projectRoot);
  const roadmapPath = path.join(projectRoot, CANONICAL_ROADMAP);
  const content = fs.readFileSync(roadmapPath, 'utf8');
  assert.match(content, /<!-- rs:managed:start -->/);
  assert.match(content, /## Release Milestones/);
});

test('cli maintain runs generate, sync, and audit in one invocation', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-maintain-'));
  writePackageJson(projectRoot);
  fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'src', 'index.js'), 'export function main() { return true; }\n', 'utf8');

  const out = run(['maintain'], projectRoot);
  const roadmapPath = path.join(projectRoot, CANONICAL_ROADMAP);
  const content = fs.readFileSync(roadmapPath, 'utf8');

  assert.match(out, /Updated .*ROADMAP\.md|No changes for .*ROADMAP\.md/);
  assert.match(out, /Audit summary:/);
  assert.match(content, /<!-- rs:managed:start -->/);
});

test('cli maintain preserves a substantive custom managed block for Electron desktop repos', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-maintain-preserve-'));
  writePackageJson(projectRoot);
  fs.mkdirSync(path.join(projectRoot, 'electron'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'electron', 'main.ts'), 'export const shell = true;\n', 'utf8');
  fs.writeFileSync(path.join(projectRoot, 'src', 'renderer.tsx'), 'export const renderer = true;\n', 'utf8');
  fs.writeFileSync(path.join(projectRoot, 'scripts', 'healthcheck.py'), 'print("helper only")\n', 'utf8');
  fs.writeFileSync(
    path.join(projectRoot, CANONICAL_ROADMAP),
    [
      '# Roadmap del Producto',
      '',
      '<!-- rs:managed:start -->',
      '## Product North Star',
      'Convertir el POS actual en una app Electron offline-first con SQLite embebido.',
      '',
      '### P0 - Migracion Firebase -> Electron + SQLite',
      '- [ ] Migrar autenticacion local para operar 100% offline <!-- rs:task=pos-migrar-autenticacion-local-offline -->',
      '  - Evidence: electron/main.ts',
      '- [ ] Reemplazar persistencia remota por SQLite embebido <!-- rs:task=pos-reemplazar-persistencia-remota-sqlite -->',
      '  - Evidence: src/renderer.tsx',
      '',
      '#### Paso operativo',
      'El flujo de ventas no debe depender de servicios web para abrir caja o cerrar turnos.',
      '<!-- rs:managed:end -->',
      ''
    ].join('\n'),
    'utf8'
  );

  run(['maintain'], projectRoot);
  const content = fs.readFileSync(path.join(projectRoot, CANONICAL_ROADMAP), 'utf8');

  assert.match(content, /Convertir el POS actual en una app Electron offline-first con SQLite embebido/);
  assert.match(content, /### P0 - Migracion Firebase -> Electron \+ SQLite/);
  assert.match(content, /#### Paso operativo/);
  assert.doesNotMatch(content, /Add SEO metadata/i);
  assert.doesNotMatch(content, /Lighthouse performance score/i);
});

test('cli maintain --dry-run is stable for the RoadmapSmith repo roadmap', () => {
  const before = fs.readFileSync(path.join(REPO_ROOT, CANONICAL_ROADMAP), 'utf8');
  const result = runResult(['maintain', '--project-root', REPO_ROOT, '--dry-run'], REPO_ROOT);
  const after = fs.readFileSync(path.join(REPO_ROOT, CANONICAL_ROADMAP), 'utf8');

  assert.equal(result.status, 0);
  assert.match(result.stdout, /No changes for .*ROADMAP\.md/);
  assert.match(result.stdout, /Audit summary:/);
  assert.doesNotMatch(result.stdout, /Add SEO metadata|Lighthouse performance score|responsive and mobile-first layout|accessibility baseline/i);
  assert.equal(after, before);
});

test('cli /roadmap-update --dry-run is stable for the RoadmapSmith repo roadmap', () => {
  const before = fs.readFileSync(path.join(REPO_ROOT, CANONICAL_ROADMAP), 'utf8');
  const result = runResult(['/roadmap-update', '--project-root', REPO_ROOT, '--dry-run'], REPO_ROOT);
  const after = fs.readFileSync(path.join(REPO_ROOT, CANONICAL_ROADMAP), 'utf8');

  assert.equal(result.status, 0);
  assert.match(result.stdout, /No changes for .*ROADMAP\.md|Dry run: .*ROADMAP\.md/i);
  assert.doesNotMatch(result.stdout, /Add SEO metadata|Lighthouse performance score|responsive and mobile-first layout|accessibility baseline/i);
  assert.equal(after, before);
});

test('cli update completes one task only after its supplied evidence validates at high confidence', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-update-task-'));
  writePackageJson(projectRoot);
  fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'src', 'customer-history.js'), 'function customerHistory() { return []; }\nmodule.exports = { customerHistory };\n', 'utf8');
  fs.writeFileSync(path.join(projectRoot, 'tests', 'customer-history.test.js'), "const { customerHistory } = require('../src/customer-history');\ntest('customer history', () => customerHistory());\n", 'utf8');
  fs.writeFileSync(
    path.join(projectRoot, CANONICAL_ROADMAP),
    [
      '## Phase P2',
      '- [ ] Implement customer history <!-- rs:task=p2-customer-history -->',
      '- [ ] Implement unrelated feature <!-- rs:task=p2-unrelated -->',
      ''
    ].join('\n'),
    'utf8'
  );

  const result = runResult([
    'update',
    '--task', 'p2-customer-history',
    '--evidence', 'src/customer-history.js, tests/customer-history.test.js'
  ], projectRoot);
  const content = fs.readFileSync(path.join(projectRoot, CANONICAL_ROADMAP), 'utf8');

  assert.equal(result.status, 0);
  assert.match(content, /- \[x\] Implement customer history/);
  assert.match(content, /Evidence: src\/customer-history\.js, tests\/customer-history\.test\.js/);
  assert.match(content, /- \[ \] Implement unrelated feature/);
});

test('cli update rejects unresolved evidence without mutating the roadmap, including dry runs', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-update-reject-'));
  writePackageJson(projectRoot);
  fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'src', 'customer-history.js'), 'function customerHistory() { return []; }\nmodule.exports = { customerHistory };\n', 'utf8');
  fs.writeFileSync(path.join(projectRoot, 'tests', 'customer-history.test.js'), "const { customerHistory } = require('../src/customer-history');\ntest('customer history', () => customerHistory());\n", 'utf8');
  const roadmapPath = path.join(projectRoot, CANONICAL_ROADMAP);
  fs.writeFileSync(
    roadmapPath,
    ['## Phase P2', '- [ ] Implement customer history <!-- rs:task=p2-customer-history -->', ''].join('\n'),
    'utf8'
  );
  const before = fs.readFileSync(roadmapPath, 'utf8');

  const result = runResult([
    '/roadmap-update',
    '--task', 'p2-customer-history',
    '--evidence', 'customer history was implemented',
    '--dry-run'
  ], projectRoot);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /must resolve in the repository and validate at high confidence/);
  assert.equal(fs.readFileSync(roadmapPath, 'utf8'), before);
});

test('cli /roadmap-update and /roadmap-sync update share stable warning output', () => {
  const projectRoot = setupFixture('warning-sync');
  fs.writeFileSync(
    path.join(projectRoot, CANONICAL_ROADMAP),
    [
      '## Phase P1',
      '- [ ] Implement backup database module for GET /api/backup <!-- rs:task=implement-backup-module -->',
      '  - Evidence: src/missing-backup.js',
      '  - ⚠️ attempted but validation failed: evidence file(s) not found: src/missing-backup.js; evidence file(s) not found: src/missing-backup.js',
      ''
    ].join('\n'),
    'utf8'
  );

  const before = fs.readFileSync(path.join(projectRoot, CANONICAL_ROADMAP), 'utf8');
  const namespaced = runResult(['/roadmap-update', '--project-root', projectRoot, '--dry-run'], projectRoot);
  const legacy = runResult(['/roadmap-sync', 'update', '--project-root', projectRoot, '--dry-run'], projectRoot);
  const after = fs.readFileSync(path.join(projectRoot, CANONICAL_ROADMAP), 'utf8');

  assert.equal(namespaced.status, 0);
  assert.equal(legacy.status, 0);
  assert.equal(after, before);
  assert.equal(legacy.stdout, namespaced.stdout);
  assert.match(legacy.stderr, /deprecated/i);
  assert.match(namespaced.stdout, /L4 \+   - ⚠️ attempted but validation failed: evidence file\(s\) not found: src\/missing-backup\.js/);
  assert.doesNotMatch(namespaced.stdout, /L4 \+.*evidence file\(s\) not found: src\/missing-backup\.js; evidence file\(s\) not found: src\/missing-backup\.js/);
});

test('cli generate refuses to replace a substantive custom managed block without --full-regen', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-generate-refuse-'));
  writePackageJson(projectRoot);
  fs.mkdirSync(path.join(projectRoot, 'electron'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'electron', 'main.ts'), 'export const shell = true;\n', 'utf8');
  fs.writeFileSync(path.join(projectRoot, 'src', 'renderer.tsx'), 'export const renderer = true;\n', 'utf8');
  fs.writeFileSync(
    path.join(projectRoot, CANONICAL_ROADMAP),
    [
      '# Roadmap del Producto',
      '',
      '<!-- rs:managed:start -->',
      '## Product North Star',
      'North star especifico del POS de escritorio.',
      '',
      '### P0 - Migracion Firebase -> Electron + SQLite',
      '- [ ] Migrar autenticacion local para operar 100% offline <!-- rs:task=pos-migrar-autenticacion-local-offline -->',
      '<!-- rs:managed:end -->',
      ''
    ].join('\n'),
    'utf8'
  );

  const result = runResult(['generate'], projectRoot);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--full-regen/);
});

test('cli regenerate intentionally rebuilds a substantive custom managed block', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-generate-full-regen-'));
  writePackageJson(projectRoot);
  fs.mkdirSync(path.join(projectRoot, 'electron'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'electron', 'main.ts'), 'export const shell = true;\n', 'utf8');
  fs.writeFileSync(path.join(projectRoot, 'src', 'renderer.tsx'), 'export const renderer = true;\n', 'utf8');
  fs.writeFileSync(
    path.join(projectRoot, CANONICAL_ROADMAP),
    [
      '# Roadmap del Producto',
      '',
      '<!-- rs:managed:start -->',
      '## Product North Star',
      'North star especifico del POS de escritorio.',
      '',
      '### P0 - Migracion Firebase -> Electron + SQLite',
      '- [ ] Migrar autenticacion local para operar 100% offline <!-- rs:task=pos-migrar-autenticacion-local-offline -->',
      '<!-- rs:managed:end -->',
      ''
    ].join('\n'),
    'utf8'
  );

  run(['regenerate'], projectRoot);
  const content = fs.readFileSync(path.join(projectRoot, CANONICAL_ROADMAP), 'utf8');

  assert.match(content, /### Phase P0 \(Critical\)/);
  assert.doesNotMatch(content, /North star especifico del POS de escritorio/);
  assert.doesNotMatch(content, /### P0 - Migracion Firebase -> Electron \+ SQLite/);
});

test('cli generate --full-regen intentionally rebuilds a substantive custom managed block', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-maintain-full-regen-'));
  writePackageJson(projectRoot);
  fs.mkdirSync(path.join(projectRoot, 'electron'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'electron', 'main.ts'), 'export const shell = true;\n', 'utf8');
  fs.writeFileSync(path.join(projectRoot, 'src', 'renderer.tsx'), 'export const renderer = true;\n', 'utf8');
  fs.writeFileSync(
    path.join(projectRoot, CANONICAL_ROADMAP),
    [
      '# Roadmap del Producto',
      '',
      '<!-- rs:managed:start -->',
      '## Product North Star',
      'North star especifico del POS de escritorio.',
      '',
      '### P0 - Migracion Firebase -> Electron + SQLite',
      '- [ ] Migrar autenticacion local para operar 100% offline <!-- rs:task=pos-migrar-autenticacion-local-offline -->',
      '<!-- rs:managed:end -->',
      ''
    ].join('\n'),
    'utf8'
  );

  run(['generate', '--full-regen'], projectRoot);
  const content = fs.readFileSync(path.join(projectRoot, CANONICAL_ROADMAP), 'utf8');

  assert.match(content, /### Phase P0 \(Critical\)/);
  assert.doesNotMatch(content, /North star especifico del POS de escritorio/);
  assert.doesNotMatch(content, /### P0 - Migracion Firebase -> Electron \+ SQLite/);
});

test('cli maintain --full-regen intentionally rebuilds a substantive custom managed block', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-maintain-full-regen-'));
  writePackageJson(projectRoot);
  fs.mkdirSync(path.join(projectRoot, 'electron'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'electron', 'main.ts'), 'export const shell = true;\n', 'utf8');
  fs.writeFileSync(path.join(projectRoot, 'src', 'renderer.tsx'), 'export const renderer = true;\n', 'utf8');
  fs.writeFileSync(
    path.join(projectRoot, CANONICAL_ROADMAP),
    [
      '# Roadmap del Producto',
      '',
      '<!-- rs:managed:start -->',
      '## Product North Star',
      'North star especifico del POS de escritorio.',
      '',
      '### P0 - Migracion Firebase -> Electron + SQLite',
      '- [ ] Migrar autenticacion local para operar 100% offline <!-- rs:task=pos-migrar-autenticacion-local-offline -->',
      '<!-- rs:managed:end -->',
      ''
    ].join('\n'),
    'utf8'
  );

  run(['maintain', '--full-regen'], projectRoot);
  const content = fs.readFileSync(path.join(projectRoot, CANONICAL_ROADMAP), 'utf8');

  assert.match(content, /### Phase P0 \(Critical\)/);
  assert.doesNotMatch(content, /North star especifico del POS de escritorio/);
  assert.doesNotMatch(content, /### P0 - Migracion Firebase -> Electron \+ SQLite/);
});

test('cli sync dry-run does not modify file', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-sync-'));
  writePackageJson(projectRoot);
  fs.writeFileSync(
    path.join(projectRoot, CANONICAL_ROADMAP),
    ['## Phase P0', '- [ ] Implement missing module <!-- rs:task=implement-missing-module -->', ''].join('\n')
  );

  const before = fs.readFileSync(path.join(projectRoot, CANONICAL_ROADMAP), 'utf8');
  run(['sync', '--dry-run'], projectRoot);
  const after = fs.readFileSync(path.join(projectRoot, CANONICAL_ROADMAP), 'utf8');

  assert.equal(after, before);
});

test('cli validate resolves Next.js app-dir route-group aliases without missing referenced file warnings', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-next-route-aliases-'));
  writePackageJson(projectRoot);
  fs.mkdirSync(path.join(projectRoot, 'src', 'app', '(auth)', 'login'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'src', 'app', '(auth)', 'setup'), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, 'src', 'app', '(auth)', 'login', 'page.tsx'),
    'export default function LoginPage() { return null; }\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(projectRoot, 'src', 'app', '(auth)', 'setup', 'page.tsx'),
    'export default function SetupPage() { return null; }\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(projectRoot, CANONICAL_ROADMAP),
    [
      '## Phase P1',
      '- [ ] Redirigir a `/login` y `/setup` segun onboarding <!-- rs:task=redirigir-login-setup -->',
      ''
    ].join('\n'),
    'utf8'
  );

  const result = runResult(['validate', '--project-root', projectRoot], projectRoot);

  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout, /missing referenced file\(s\): \/login/);
  assert.doesNotMatch(result.stdout, /missing referenced file\(s\): \/setup/);
  assert.match(result.stdout, /file reference shows implementation location, not confirmed completion/);
});

test('cli validate prints diagnostic codes and includes them in JSON output', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-diagnostics-'));
  writePackageJson(projectRoot);
  fs.writeFileSync(
    path.join(projectRoot, CANONICAL_ROADMAP),
    ['## Phase P0', '- [ ] Implement missing module <!-- rs:task=implement-missing-module -->', ''].join('\n'),
    'utf8'
  );

  const human = runResult(['validate', '--project-root', projectRoot], projectRoot);
  const json = runResult(['validate', '--json', '--project-root', projectRoot], projectRoot);
  const payload = JSON.parse(json.stdout);

  assert.equal(human.status, 1);
  assert.match(human.stdout, /FAIL:NOT_IMPLEMENTED \[implement-missing-module\]/);
  assert.equal(json.status, 1);
  assert.ok(payload[0].result.diagnostics.some((item) => item.code === 'NOT_IMPLEMENTED' && item.severity === 'error'));
});

test('cli validate prints deterministic failures and standalone behavioral warnings', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-deterministic-'));
  writePackageJson(projectRoot);
  fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'next.config.js'), 'module.exports = { eslint: { ignoreDuringBuilds: true } };\n', 'utf8');
  fs.writeFileSync(path.join(projectRoot, 'src', 'login.tsx'), 'export const Login = () => <button disabled={isSubmitting} />;\n', 'utf8');
  fs.writeFileSync(
    path.join(projectRoot, CANONICAL_ROADMAP),
    [
      '## Phase P0',
      '- [ ] Enable ESLint builds <!-- rs:task=eslint-builds -->',
      '  - Verify: kind=property; file=next.config.js; key=ignoreDuringBuilds; equals=false',
      '- [ ] Disable login submit <!-- rs:task=login-submit -->',
      ''
    ].join('\n'),
    'utf8'
  );

  const human = runResult(['validate', '--project-root', projectRoot], projectRoot);
  assert.equal(human.status, 1);
  assert.match(human.stdout, /FAIL:WRONG_VALUE \[eslint-builds\]/);
  assert.match(human.stdout, /WARN:REQUIRES_HUMAN_EVIDENCE \[login-submit\]/);
});

test('cli sync rewrites legacy attempted warnings and reaches a fixed point on the second run', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-legacy-warning-fixed-point-'));
  writePackageJson(projectRoot);
  fs.mkdirSync(path.join(projectRoot, 'src', 'app', 'api', 'mercadopago', 'preference'), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, 'src', 'app', 'api', 'mercadopago', 'preference', 'route.ts'),
    [
      'export async function POST() {',
      "  return fetch('https://api.mercadopago.com/checkout/preferences');",
      '}',
      ''
    ].join('\n'),
    'utf8'
  );
  fs.writeFileSync(
    path.join(projectRoot, CANONICAL_ROADMAP),
    [
      '## Phase P2',
      '- [ ] Integracion Mercado Pago Point (posnet) via SDK local <!-- rs:task=p2-mp-point-integration -->',
      '  - ⚠️ attempted but validation failed: weak path-only evidence lacks content-specific token match',
      ''
    ].join('\n'),
    'utf8'
  );

  const first = runResult(['sync', '--project-root', projectRoot], projectRoot);
  const second = runResult(['sync', '--project-root', projectRoot, '--dry-run'], projectRoot);
  const content = fs.readFileSync(path.join(projectRoot, CANONICAL_ROADMAP), 'utf8');

  assert.equal(first.status, 0);
  assert.equal(second.status, 0);
  assert.match(first.stdout, /Updated .*ROADMAP\.md/);
  assert.match(second.stdout, /No changes for .*ROADMAP\.md/);
  assert.doesNotMatch(content, /⚠️ attempted but validation failed/);
  assert.match(content, /⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match/);
});

test('cli sync preserves existing managed block structure on weak path-only failures', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-sync-managed-'));
  writePackageJson(projectRoot);
  fs.mkdirSync(path.join(projectRoot, 'electron'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'electron', 'main.ts'), 'let boot = true;\n', 'utf8');
  fs.writeFileSync(path.join(projectRoot, 'src', 'app.js'), 'function appModule() { return true; }\n', 'utf8');
  fs.writeFileSync(
    path.join(projectRoot, CANONICAL_ROADMAP),
    [
      '# Product Roadmap',
      '',
      '- [ ] Implement app module <!-- rs:task=outside-implement-app-module -->',
      '',
      '<!-- rs:managed:start -->',
      '## Phase Alfa: Desktop Shell Comercial',
      '',
      'Contexto de negocio: el shell Electron mantiene Next.js embebido para demos offline.',
      '',
      '- [ ] Configurar Electron con Next.js como servidor embebido <!-- rs:task=p0-configurar-electron-next-embedded-server -->',
      '',
      '### Criterio de avance',
      'La experiencia de escritorio debe iniciar sin depender de servicios externos.',
      '<!-- rs:managed:end -->',
      ''
    ].join('\n'),
    'utf8'
  );

  run(['sync'], projectRoot);
  run(['sync'], projectRoot);

  const content = fs.readFileSync(path.join(projectRoot, CANONICAL_ROADMAP), 'utf8');
  const warningMatches = content.match(/⚠️ no implementation evidence found yet/g) || [];

  assert.equal(warningMatches.length, 1);
  assert.match(content, /## Phase Alfa: Desktop Shell Comercial/);
  assert.match(content, /Contexto de negocio: el shell Electron mantiene Next\.js embebido para demos offline\./);
  assert.match(content, /### Criterio de avance/);
  assert.match(content, /La experiencia de escritorio debe iniciar sin depender de servicios externos\./);
  assert.match(content, /- \[ \] Configurar Electron con Next\.js como servidor embebido/);
  assert.match(content, /weak path-only evidence lacks content-specific token match/);
  assert.match(content, /- \[ \] Implement app module <!-- rs:task=outside-implement-app-module -->/);
  assert.doesNotMatch(content, /Add SEO metadata/);
  assert.doesNotMatch(content, /Implement responsive/);
  assert.doesNotMatch(content, /Foundation Baseline/);
  assert.doesNotMatch(content, /Detected Project Profile/);
});

test('cli generate uses legacy roadmap.md when canonical roadmap is missing', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-legacy-fallback-'));
  writePackageJson(projectRoot);
  fs.writeFileSync(path.join(projectRoot, LEGACY_ROADMAP), '# Legacy roadmap\n', 'utf8');

  run(['generate'], projectRoot);

  const legacyPath = path.join(projectRoot, LEGACY_ROADMAP);
  const legacyContent = fs.readFileSync(legacyPath, 'utf8');
  assert.match(legacyContent, /<!-- rs:managed:start -->/);
  assert.equal(hasEntry(projectRoot, CANONICAL_ROADMAP), false);
});

test('cli generate prefers ROADMAP.md when canonical and legacy files both exist', (t) => {
  if (!CASE_DISTINCT_ROADMAP_FILES) {
    t.skip('Filesystem is case-insensitive; roadmap.md and ROADMAP.md cannot coexist as separate files.');
    return;
  }

  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-canonical-priority-'));
  writePackageJson(projectRoot);
  const legacyPath = path.join(projectRoot, LEGACY_ROADMAP);
  const canonicalPath = path.join(projectRoot, CANONICAL_ROADMAP);
  fs.writeFileSync(legacyPath, '# Legacy roadmap should stay untouched\n', 'utf8');
  fs.writeFileSync(canonicalPath, '# Canonical roadmap should be updated\n', 'utf8');

  run(['generate'], projectRoot);

  const legacyContent = fs.readFileSync(legacyPath, 'utf8');
  const canonicalContent = fs.readFileSync(canonicalPath, 'utf8');
  assert.equal(legacyContent, '# Legacy roadmap should stay untouched\n');
  assert.match(canonicalContent, /<!-- rs:managed:start -->/);
});

test('cli generate respects --roadmap-file override', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-override-'));
  writePackageJson(projectRoot);
  const overrideTarget = CASE_DISTINCT_ROADMAP_FILES ? LEGACY_ROADMAP : 'legacy/roadmap.md';
  const overridePath = path.join(projectRoot, overrideTarget);
  const canonicalPath = path.join(projectRoot, CANONICAL_ROADMAP);
  fs.mkdirSync(path.dirname(overridePath), { recursive: true });
  fs.writeFileSync(overridePath, '# Override target\n', 'utf8');
  fs.writeFileSync(canonicalPath, '# Canonical should remain untouched\n', 'utf8');

  run(['generate', '--roadmap-file', overrideTarget], projectRoot);

  const legacyContent = fs.readFileSync(overridePath, 'utf8');
  const canonicalContent = fs.readFileSync(canonicalPath, 'utf8');
  assert.match(legacyContent, /<!-- rs:managed:start -->/);
  assert.equal(canonicalContent, '# Canonical should remain untouched\n');
});

test('cli generate respects config roadmapFile override', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-config-override-'));
  writePackageJson(projectRoot);
  const configTarget = CASE_DISTINCT_ROADMAP_FILES ? './roadmap.md' : './legacy/roadmap.md';
  const configPath = path.join(projectRoot, configTarget.replace('./', ''));
  const canonicalPath = path.join(projectRoot, CANONICAL_ROADMAP);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, '# Config target\n', 'utf8');
  fs.writeFileSync(canonicalPath, '# Canonical should remain untouched\n', 'utf8');
  fs.writeFileSync(
    path.join(projectRoot, 'roadmap-skill.config.json'),
    JSON.stringify({ roadmapFile: configTarget }, null, 2),
    'utf8'
  );

  run(['generate'], projectRoot);

  const legacyContent = fs.readFileSync(configPath, 'utf8');
  const canonicalContent = fs.readFileSync(canonicalPath, 'utf8');
  assert.match(legacyContent, /<!-- rs:managed:start -->/);
  assert.equal(canonicalContent, '# Canonical should remain untouched\n');
});

test('--version prints the package version', () => {
  const pkg = require('../package.json');
  const out = run(['--version'], process.cwd());
  assert.equal(out.trim(), pkg.version);
});

test('-v prints the package version', () => {
  const pkg = require('../package.json');
  const out = run(['-v'], process.cwd());
  assert.equal(out.trim(), pkg.version);
});

test('no args prints usage', () => {
  const out = run([], process.cwd());
  assert.match(out, /Usage:/);
  assert.match(out, /roadmapsmith zero/);
  assert.match(out, /roadmapsmith maintain/);
  assert.match(out, /--full-regen/);
  assert.match(out, /\/roadmap-update/);
  assert.doesNotMatch(out, /\/roadmap-regenerate/);
});

test('cli /roadmap prints the contextual slash palette', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-slash-palette-'));
  const out = run(['/roadmap'], projectRoot);

  assert.match(out, /RoadmapSmith slash palette/);
  assert.match(out, /roadmapsmith maintain/);
});

test('cli /roadmap-maintain executes the one-command existing-repo flow', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-slash-maintain-'));
  writePackageJson(projectRoot);
  fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'src', 'index.js'), 'function main() { return true; }\n', 'utf8');

  const out = run(['/roadmap-maintain'], projectRoot);

  assert.match(out, /Audit summary:/);
  assert.equal(fs.existsSync(path.join(projectRoot, CANONICAL_ROADMAP)), true);
});

test('cli /roadmap sync resolves to sync without changing dry-run behavior', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-slash-sync-'));
  writePackageJson(projectRoot);
  fs.writeFileSync(
    path.join(projectRoot, CANONICAL_ROADMAP),
    ['## Phase P0', '- [ ] Implement missing module <!-- rs:task=implement-missing-module -->', ''].join('\n')
  );

  const before = fs.readFileSync(path.join(projectRoot, CANONICAL_ROADMAP), 'utf8');
  const out = run(['/roadmap', 'sync', '--dry-run'], projectRoot);
  const after = fs.readFileSync(path.join(projectRoot, CANONICAL_ROADMAP), 'utf8');

  assert.equal(after, before);
  assert.match(out, /No changes for|Dry run:/);
});

test('cli bare /roadmap-sync shows legacy palette help instead of executing', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-slash-direct-sync-'));
  writePackageJson(projectRoot);
  fs.writeFileSync(
    path.join(projectRoot, CANONICAL_ROADMAP),
    ['## Phase P0', '- [ ] Implement missing module <!-- rs:task=implement-missing-module -->', ''].join('\n')
  );

  const before = fs.readFileSync(path.join(projectRoot, CANONICAL_ROADMAP), 'utf8');
  const out = run(['/roadmap-sync', '--dry-run'], projectRoot);
  const after = fs.readFileSync(path.join(projectRoot, CANONICAL_ROADMAP), 'utf8');

  assert.equal(after, before);
  assert.match(out, /RoadmapSmith slash palette/);
  assert.match(out, /\/roadmap-update/);
});

test('cli /roadmap-sync validate resolves to validate', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-slash-validate-'));
  writePackageJson(projectRoot);
  fs.writeFileSync(
    path.join(projectRoot, CANONICAL_ROADMAP),
    ['## Phase P0', '- [ ] Implement missing module <!-- rs:task=implement-missing-module -->', ''].join('\n')
  );

  const result = runResult(['/roadmap-sync', 'validate', '--json'], projectRoot);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /deprecated/i);
  assert.match(result.stdout, /\[\s*\{/);
});

test('cli ambiguous slash input shows suggestions and does not execute', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-slash-ambiguous-'));
  const out = run(['/roadmap', 's'], projectRoot);

  assert.match(out, /No exact slash match was executed/);
  assert.match(out, /\/roadmap-status/);
  assert.match(out, /\/roadmap-update/);
  assert.match(out, /\/roadmap-sync/);
  assert.match(out, /\/roadmap-setup/);
});

test('cli unknown direct slash input shows related help safely', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-slash-unknown-'));
  const result = runResult(['/syn'], projectRoot);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /RoadmapSmith slash palette/);
  assert.match(result.stdout, /\/roadmap-update/);
  assert.match(result.stdout, /\/roadmap-sync/);
});

test('cli zero fails clearly in non-interactive mode', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-zero-noninteractive-'));
  const result = runResult(['zero'], projectRoot);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /interactive terminal/i);
});

test('doctor --json reports missing integration state', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-doctor-missing-'));
  run(['init'], projectRoot);

  const result = runResult(['doctor', '--json', '--project-root', projectRoot], projectRoot, {
    env: buildNoCliEnv()
  });
  const payload = JSON.parse(result.stdout);

  assert.notEqual(result.status, 0);
  assert.equal(payload.cli.ready, true);
  assert.equal(payload.cli.kind, 'current-process');
  assert.equal(payload.vscode.tasks.ready, false);
  assert.equal(payload.hosts.codex.ready, false);
  assert.equal(payload.hosts.claude.ready, false);
  assert.deepEqual(Object.keys(payload.surfaces).sort(), ['claudeCli', 'claudeGui', 'codexCli', 'codexGui']);
});

test('doctor --json reports healthy configured integration state', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-doctor-ready-'));
  run(['init'], projectRoot);
  fs.mkdirSync(path.join(projectRoot, 'roadmap-skill', 'bin'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'roadmap-skill', 'bin', 'cli.js'), '\'use strict\';\n', 'utf8');
  run(['setup'], projectRoot);

  const result = runResult(['doctor', '--json', '--project-root', projectRoot], projectRoot);
  const payload = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.equal(payload.cli.ready, true);
  assert.equal(payload.vscode.tasks.ready, true);
  assert.equal(payload.runtime.ready, true);
  assert.equal(payload.hosts.codex.ready, true);
  assert.equal(payload.hosts.claude.ready, true);
  assert.deepEqual(payload.surfaces.claudeGui.availableCommands, [
    '/roadmap',
    '/roadmap-zero',
    '/roadmap-maintain',
    '/roadmap-status',
    '/roadmap-init',
    '/roadmap-generate',
    '/roadmap-validate',
    '/roadmap-update',
    '/roadmap-sync',
    '/roadmap-audit',
    '/roadmap-setup'
  ]);
});

test('doctor --json reports missing task runtime without downgrading Claude readiness', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-doctor-runtime-missing-'));
  run(['init'], projectRoot);
  fs.mkdirSync(path.join(projectRoot, 'roadmap-skill', 'bin'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'roadmap-skill', 'bin', 'cli.js'), '\'use strict\';\n', 'utf8');
  run(['setup'], projectRoot);

  const emptyRuntimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-empty-runtime-'));
  const result = runResult(['doctor', '--json', '--project-root', projectRoot], projectRoot, {
    env: {
      PATH: '',
      ROADMAPSMITH_NODE: '',
      ProgramFiles: emptyRuntimeRoot,
      'ProgramFiles(x86)': emptyRuntimeRoot,
      LocalAppData: emptyRuntimeRoot
    }
  });
  const payload = JSON.parse(result.stdout);

  assert.notEqual(result.status, 0);
  assert.equal(payload.cli.ready, true);
  assert.equal(payload.vscode.tasks.ready, true);
  assert.equal(payload.runtime.ready, false);
  assert.equal(payload.hosts.codex.ready, false);
  assert.equal(payload.hosts.claude.ready, true);
  assert.deepEqual(Object.keys(payload.surfaces).sort(), ['claudeCli', 'claudeGui', 'codexCli', 'codexGui']);
});

test('status --json matches doctor --json payload and exit semantics', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-status-alias-'));
  run(['init'], projectRoot);

  const doctorResult = runResult(['doctor', '--json', '--project-root', projectRoot], projectRoot, {
    env: buildNoCliEnv()
  });
  const statusResult = runResult(['status', '--json', '--project-root', projectRoot], projectRoot, {
    env: buildNoCliEnv()
  });

  assert.equal(statusResult.status, doctorResult.status);
  assert.deepEqual(JSON.parse(statusResult.stdout), JSON.parse(doctorResult.stdout));
});

test('launcher accepts /roadmap and prints the same conceptual palette', () => {
  const result = runLauncherResult(['/roadmap'], path.resolve(__dirname, '..', '..'));

  assert.equal(result.status, 0);
  assert.match(result.stdout, /RoadmapSmith slash palette/);
  assert.match(result.stdout, /\/roadmap maintain/);
});

test('launcher keeps non-slash actions working', () => {
  const result = runLauncherResult(['explain'], path.resolve(__dirname, '..', '..'));

  assert.equal(result.status, 0);
  assert.match(result.stdout, /RoadmapSmith layers/);
  assert.match(result.stdout, /RoadmapSmith: Zero Mode/);
});

test('generated launcher accepts maintain for temp projects', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-launcher-maintain-'));
  writePackageJson(projectRoot);
  writeWorkspaceCliShim(projectRoot);
  fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'src', 'index.js'), 'function main() { return true; }\n', 'utf8');
  run(['setup', '--hosts', 'codex', '--project-root', projectRoot], projectRoot);

  const launcherPath = path.join(projectRoot, '.vscode', 'roadmapsmith-launcher.js');
  const result = spawnSync(process.execPath, [launcherPath, 'maintain'], {
    cwd: projectRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Audit summary:/);
});

test('task wrapper can launch the launcher via ROADMAPSMITH_NODE override', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-wrapper-override-'));
  writeWorkspaceCliShim(projectRoot);
  run(['setup', '--hosts', 'codex', '--project-root', projectRoot], projectRoot);

  const result = runWrapperResult(projectRoot, 'explain', {
    env: {
      PATH: '',
      ROADMAPSMITH_NODE: process.execPath,
      ProgramFiles: '',
      'ProgramFiles(x86)': '',
      LocalAppData: ''
    }
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /RoadmapSmith layers/);
});

test('task wrapper prints a friendly runtime diagnostic when Node cannot be resolved', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-cli-wrapper-missing-runtime-'));
  run(['setup', '--hosts', 'codex', '--project-root', projectRoot], projectRoot);
  const emptyRuntimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-empty-runtime-'));
  const missingRuntimeEnv = {
    PATH: '',
    ROADMAPSMITH_NODE: '',
    ProgramFiles: emptyRuntimeRoot,
    'ProgramFiles(x86)': emptyRuntimeRoot,
    LocalAppData: emptyRuntimeRoot
  };

  const statusResult = runWrapperResult(projectRoot, 'status', { env: missingRuntimeEnv });
  const syncResult = runWrapperResult(projectRoot, 'sync', { env: missingRuntimeEnv });

  assert.equal(statusResult.status, 0);
  assert.match(statusResult.stdout, /RoadmapSmith VS Code task runtime error/);
  assert.match(statusResult.stdout, /ROADMAPSMITH_NODE/);
  assert.notEqual(syncResult.status, 0);
  assert.match(syncResult.stdout, /RoadmapSmith VS Code task runtime error/);
});
