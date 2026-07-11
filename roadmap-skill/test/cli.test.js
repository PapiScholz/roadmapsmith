'use strict';
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const CLI = path.resolve(__dirname, '../bin/cli.js');

function run(args, cwd) {
  return execFileSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });
}

function runResult(args, cwd) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });
}

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rs-cli3-'));
}

// ─── init ────────────────────────────────────────────────────────────────────

test('init creates ROADMAP.md in empty directory', () => {
  const dir = tmpdir();
  run(['init', '--project-root', dir], dir);
  assert.ok(fs.existsSync(path.join(dir, 'ROADMAP.md')));
});

test('init creates AGENTS.md alongside ROADMAP.md', () => {
  const dir = tmpdir();
  run(['init', '--project-root', dir], dir);
  assert.ok(fs.existsSync(path.join(dir, 'AGENTS.md')));
});

test('init skips existing ROADMAP.md', () => {
  const dir = tmpdir();
  const roadmapPath = path.join(dir, 'ROADMAP.md');
  fs.writeFileSync(roadmapPath, '# My existing roadmap\n');
  run(['init', '--project-root', dir], dir);
  const content = fs.readFileSync(roadmapPath, 'utf8');
  assert.ok(content.includes('My existing roadmap'), 'should not overwrite existing');
});

test('init --dry-run does not create files', () => {
  const dir = tmpdir();
  run(['init', '--dry-run', '--project-root', dir], dir);
  assert.ok(!fs.existsSync(path.join(dir, 'ROADMAP.md')));
  assert.ok(!fs.existsSync(path.join(dir, 'AGENTS.md')));
});

test('init --dry-run prints "Would create" messages', () => {
  const dir = tmpdir();
  const out = run(['init', '--dry-run', '--project-root', dir], dir);
  assert.ok(/would create/i.test(out));
});

test('init --product-name appears in generated ROADMAP.md', () => {
  const dir = tmpdir();
  run(['init', '--product-name', 'SuperWidget', '--project-root', dir], dir);
  const content = fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8');
  assert.ok(content.includes('SuperWidget'));
});

test('init --problem-statement appears in generated ROADMAP.md', () => {
  const dir = tmpdir();
  run(['init', '--problem-statement', 'Nobody can find the button', '--project-root', dir], dir);
  const content = fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8');
  assert.ok(content.includes('Nobody can find the button'));
});

test('init --import imports tasks from existing file', () => {
  const dir = tmpdir();
  const srcRoadmap = path.join(dir, 'OLD_ROADMAP.md');
  fs.writeFileSync(srcRoadmap, '# Old\n\n- [ ] Migrate the database <!-- rs:task=migrate-db -->\n');
  run(['init', '--import', srcRoadmap, '--project-root', dir], dir);
  const content = fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8');
  assert.ok(content.includes('Migrate the database') || content.includes('migrate-db'));
});

// ─── unknown command ──────────────────────────────────────────────────────────

test('unknown command exits with code 1', () => {
  const dir = tmpdir();
  const result = runResult(['foobar', '--project-root', dir], dir);
  assert.equal(result.status, 1);
});

test('unknown command prints help or error to output', () => {
  const dir = tmpdir();
  const result = runResult(['foobar', '--project-root', dir], dir);
  assert.ok(/unknown command|init|update/i.test(result.stderr + result.stdout));
});

// ─── update ───────────────────────────────────────────────────────────────────

test('update refresh writes updated ROADMAP.md', () => {
  const dir = tmpdir();
  const initial = `<!-- rs:managed:start -->\n# Roadmap\n\n- [ ] Build the thing <!-- rs:task=build-thing -->\n<!-- rs:managed:end -->\n`;
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), initial);
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'test-project', version: '1.0.0' }));
  run(['update', '--project-root', dir], dir);
  const content = fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8');
  assert.ok(content.includes('rs:managed:start'));
});

test('update --dry-run does not modify ROADMAP.md', () => {
  const dir = tmpdir();
  const initial = `<!-- rs:managed:start -->\n# Roadmap\n- [ ] Do something <!-- rs:task=do-something -->\n<!-- rs:managed:end -->\n`;
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), initial);
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'test' }));
  run(['update', '--dry-run', '--project-root', dir], dir);
  const content = fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8');
  assert.equal(content, initial);
});

test('update --add-task inserts task in managed block', () => {
  const dir = tmpdir();
  const initial = `<!-- rs:managed:start -->\n# Roadmap\n\n### Phase P1\n\n<!-- rs:managed:end -->\n`;
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), initial);
  run(['update', '--add-task', 'Fix the login bug', '--project-root', dir], dir);
  const content = fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8');
  assert.ok(content.includes('Fix the login bug'));
});

test('update --add-task --dry-run does not write', () => {
  const dir = tmpdir();
  const initial = `<!-- rs:managed:start -->\n# Roadmap\n\n### Phase P1\n\n<!-- rs:managed:end -->\n`;
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), initial);
  run(['update', '--add-task', 'New feature', '--dry-run', '--project-root', dir], dir);
  const content = fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8');
  assert.ok(!content.includes('New feature'));
});

test('update --task --evidence adds Evidence line', () => {
  const dir = tmpdir();
  const initial = `<!-- rs:managed:start -->\n# Roadmap\n\n- [ ] Build the thing <!-- rs:task=build-thing -->\n<!-- rs:managed:end -->\n`;
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), initial);
  run(['update', '--task', 'build-thing', '--evidence', 'src/thing.js passes all tests', '--project-root', dir], dir);
  const content = fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8');
  assert.ok(content.includes('Evidence:'));
  assert.ok(content.includes('src/thing.js passes all tests'));
});

test('update --task with unknown id exits 1', () => {
  const dir = tmpdir();
  const initial = `<!-- rs:managed:start -->\n# Roadmap\n- [ ] A task <!-- rs:task=a-task -->\n<!-- rs:managed:end -->\n`;
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), initial);
  const result = runResult(['update', '--task', 'nonexistent', '--evidence', 'x', '--project-root', dir], dir);
  assert.equal(result.status, 1);
});

// ─── --concise / --no-warnings ────────────────────────────────────────────────

test('update --concise strips ⚠️ lines from output', () => {
  const dir = tmpdir();
  const initial = [
    '<!-- rs:managed:start -->',
    '# Roadmap',
    '',
    '- [ ] Do the thing <!-- rs:task=do-thing -->',
    '  - Evidence: src/nonexistent.ts',
    '<!-- rs:managed:end -->',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), initial);
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'test' }));
  run(['update', '--concise', '--project-root', dir], dir);
  const content = fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8');
  assert.doesNotMatch(content, /⚠️/);
});

// ─── verify ───────────────────────────────────────────────────────────────────

test('verify without --task exits 1', () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), '');
  const result = runResult(['verify', '--project-root', dir], dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--task/);
});

test('verify --task without --run prints "Would run"', () => {
  const dir = tmpdir();
  const initial = [
    '<!-- rs:managed:start -->',
    '# Roadmap',
    '',
    '- [ ] TSC clean <!-- rs:task=tsc-clean rs:kind=command rs:verified-by=echo-hi -->',
    '<!-- rs:managed:end -->',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), initial);
  const out = run(['verify', '--task', 'tsc-clean', '--project-root', dir], dir);
  assert.match(out, /Would run: echo-hi/);
});

test('verify --task on non-command task exits 1', () => {
  const dir = tmpdir();
  const initial = [
    '<!-- rs:managed:start -->',
    '# Roadmap',
    '',
    '- [ ] Regular task <!-- rs:task=regular -->',
    '<!-- rs:managed:end -->',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), initial);
  const result = runResult(['verify', '--task', 'regular', '--project-root', dir], dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not rs:kind=command/);
});

test('verify --task --run flips checkbox on exit-0 command', () => {
  const dir = tmpdir();
  const initial = [
    '<!-- rs:managed:start -->',
    '# Roadmap',
    '',
    '- [ ] Trivial pass <!-- rs:task=trivial-pass rs:kind=command rs:verified-by=hostname -->',
    '<!-- rs:managed:end -->',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), initial);
  run(['verify', '--task', 'trivial-pass', '--run', '--project-root', dir], dir);
  const content = fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8');
  assert.match(content, /- \[x\] Trivial pass/);
});

test('verify --task --run on failing command exits 2 and leaves checkbox', () => {
  const dir = tmpdir();
  const initial = [
    '<!-- rs:managed:start -->',
    '# Roadmap',
    '',
    '- [ ] Fails <!-- rs:task=fails rs:kind=command rs:verified-by=zzz-not-a-real-cmd-x9k -->',
    '<!-- rs:managed:end -->',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), initial);
  const result = runResult(['verify', '--task', 'fails', '--run', '--project-root', dir], dir);
  assert.equal(result.status, 2);
  const content = fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8');
  assert.match(content, /- \[ \] Fails/);
});
