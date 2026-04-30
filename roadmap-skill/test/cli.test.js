'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const CLI = path.resolve(__dirname, '..', 'bin', 'cli.js');
const CANONICAL_ROADMAP = 'ROADMAP.md';
const LEGACY_ROADMAP = 'roadmap.md';
const CASE_DISTINCT_ROADMAP_FILES = supportsCaseDistinctRoadmapFiles();

function run(args, cwd) {
  return execFileSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8'
  });
}

function writePackageJson(projectRoot) {
  fs.writeFileSync(path.join(projectRoot, 'package.json'), JSON.stringify({ name: 'x', version: '1.0.0' }, null, 2));
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
});
