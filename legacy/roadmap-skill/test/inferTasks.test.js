'use strict';
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { inferTasks } = require('../src/inferTasks');
const CLI = path.resolve(__dirname, '../bin/cli.js');

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rs-infer-'));
}

function writeFile(dir, rel, content) {
  const abs = path.join(dir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
}

function runInit(args, cwd) {
  return execFileSync(process.execPath, [CLI, 'init', '--project-root', cwd, ...args], { cwd, encoding: 'utf8' });
}

// ─── inferTasks unit tests ────────────────────────────────────────────────────

test('inferTasks extracts JS function names into P0 tasks', () => {
  const dir = tmpdir();
  writeFile(dir, 'src/auth.js', 'function loginUser(u) { return u; }\nfunction logoutUser(u) { return u; }\n');
  const r = inferTasks(dir);
  const p0Texts = r.tasks.filter((t) => t.priority === 'P0').map((t) => t.text);
  assert.ok(p0Texts.some((t) => t.includes('loginUser')), 'expected loginUser task');
  assert.ok(p0Texts.some((t) => t.includes('logoutUser')), 'expected logoutUser task');
});

test('inferTasks extracts Python def names into P0 tasks', () => {
  const dir = tmpdir();
  writeFile(dir, 'src/handlers.py', 'def process_request(req):\n    return req\n\nasync def send_email(to):\n    return to\n');
  const r = inferTasks(dir);
  const p0Texts = r.tasks.filter((t) => t.priority === 'P0').map((t) => t.text);
  assert.ok(p0Texts.some((t) => t.includes('process_request')));
  assert.ok(p0Texts.some((t) => t.includes('send_email')));
});

test('inferTasks extracts TypeScript function and class names', () => {
  const dir = tmpdir();
  writeFile(dir, 'src/types.ts', 'export function fetchUser(id: string) { return id; }\nexport class UserRepo {}\n');
  const r = inferTasks(dir);
  const texts = r.tasks.map((t) => t.text);
  assert.ok(texts.some((t) => t.includes('fetchUser')));
  assert.ok(texts.some((t) => t.includes('UserRepo')));
});

test('inferTasks skips functions that have a matching sibling test file', () => {
  const dir = tmpdir();
  writeFile(dir, 'src/api.js', 'function callApi(u) { return u; }\n');
  writeFile(dir, 'src/api.test.js', "require('assert').equal(1, 1);\n");
  const r = inferTasks(dir);
  assert.equal(r.tasks.filter((t) => t.text.includes('callApi')).length, 0);
});

test('inferTasks extracts TODO/FIXME/HACK comments as P1 tasks', () => {
  const dir = tmpdir();
  writeFile(dir, 'src/api.js', 'function callApi() { return 0; }\n// TODO: add retry logic\n# FIXME: not a JS comment\n');
  const r = inferTasks(dir);
  const p1 = r.tasks.filter((t) => t.priority === 'P1');
  assert.ok(p1.some((t) => t.text.includes('add retry logic')), 'expected TODO in P1');
});

test('inferTasks caps at 10 tasks by default', () => {
  const dir = tmpdir();
  let body = '';
  for (let i = 0; i < 25; i += 1) body += `function fn${i}() { return ${i}; }\n`;
  writeFile(dir, 'src/many.js', body);
  const r = inferTasks(dir);
  assert.equal(r.tasks.length, 10);
});

test('inferTasks ignores files under test/, scripts/, fixtures/, examples/', () => {
  const dir = tmpdir();
  writeFile(dir, 'test/dontExtract.js', 'function shouldSkip() { return 0; }\n');
  writeFile(dir, 'scripts/build.js', 'function alsoSkip() { return 0; }\n');
  const r = inferTasks(dir);
  assert.equal(r.tasks.length, 0);
});

// ─── init branching (integration) ─────────────────────────────────────────────

test('init on empty repo produces minimal "Your first tasks" shape, no Phase headers', () => {
  const dir = tmpdir();
  runInit([], dir);
  const md = fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8');
  assert.ok(md.includes('Your first tasks'), 'expected minimal shape');
  assert.ok(!md.includes('### Phase P0'), 'expected no P0 phase heading');
  assert.ok(!md.includes('Stabilize project baseline'), 'expected no phaseTemplate boilerplate');
});

test('init on repo with signal produces task lines that name real files', () => {
  const dir = tmpdir();
  writeFile(dir, 'src/auth.js', 'function loginUser() {}\nfunction logoutUser() {}\nfunction resetPassword() {}\n');
  runInit(['--product-name', 'DynApp'], dir);
  const md = fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8');
  assert.ok(md.includes('src/auth.js'), 'expected file reference in task text');
  assert.ok(md.includes('loginUser'), 'expected function name in task');
  assert.ok(md.includes('### Phase P0'), 'expected P0 heading when tasks present');
});

test('init --with-phase-templates emits the v0.14.x static template (backward compat)', () => {
  const dir = tmpdir();
  runInit(['--with-phase-templates'], dir);
  const md = fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8');
  assert.ok(md.includes('Stabilize project baseline'), 'expected phaseTemplate boilerplate');
  assert.ok(md.includes('Product North Star'), 'expected v0.14 North Star heading');
});

test('init without --with-phase-templates on empty repo omits phaseTemplate boilerplate', () => {
  const dir = tmpdir();
  runInit([], dir);
  const md = fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8');
  assert.ok(!md.includes('Stabilize project baseline'));
  assert.ok(!md.includes('Reduce operational risk before v0.3'));
});

// ─── --interactive (Rec 4) ────────────────────────────────────────────────────

test('init --interactive with piped stdin produces a ROADMAP.md matching the answers', () => {
  const dir = tmpdir();
  const result = spawnSync(process.execPath, [CLI, 'init', '--interactive', '--project-root', dir], {
    cwd: dir,
    encoding: 'utf8',
    input: 'MyInteractiveApp\ninteractive dev\ny\nclaude\n',
  });
  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const md = fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8');
  assert.ok(md.includes('MyInteractiveApp'), 'product name from prompt should appear');
  assert.ok(md.includes('interactive dev'), 'primary user from prompt should appear');
});

test('init --interactive answering "n" to AI-agents exits 0 with the redirect message and creates no files', () => {
  const dir = tmpdir();
  const result = spawnSync(process.execPath, [CLI, 'init', '--interactive', '--project-root', dir], {
    cwd: dir,
    encoding: 'utf8',
    input: 'NoAgentApp\nsomeone\nn\nclaude\n',
  });
  assert.equal(result.status, 0);
  assert.ok(/TODO\.md/i.test(result.stdout), 'expected TODO.md redirect message');
  assert.ok(!fs.existsSync(path.join(dir, 'ROADMAP.md')), 'should NOT create ROADMAP.md on n');
});
