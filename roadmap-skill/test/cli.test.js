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
  run(['update', '--apply', '--project-root', dir], dir);
  const content = fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8');
  assert.ok(content.includes('rs:managed:start'));
});

// rs:kind=manual is a human-attested bypass → validator returns passed:true → sync would flip if allowed.
function writeApplyFixture(dir) {
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'test' }));
  const initial = [
    '<!-- rs:managed:start -->',
    '- [ ] Manual bypass task <!-- rs:task=manual-task rs:kind=manual -->',
    '<!-- rs:managed:end -->',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), initial);
}

test('update defaults to annotate-only: does not flip [ ] to [x] even when validation passes', () => {
  const dir = tmpdir();
  writeApplyFixture(dir);
  const out = run(['update', '--project-root', dir], dir);
  const content = fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8');
  assert.match(content, /- \[ \] Manual bypass task/, 'checkbox must stay unchecked without --apply');
  // v0.13.4: status may be "annotate-only ..." when the sync adds annotations, or "No changes"
  // when the roadmap is already byte-identical to the sync output. Both prove no [x] flip.
  assert.match(out, /annotate-only|No changes for /);
});

test('update --apply flips [ ] to [x] when validation passes', () => {
  const dir = tmpdir();
  writeApplyFixture(dir);
  run(['update', '--apply', '--project-root', dir], dir);
  const content = fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8');
  assert.match(content, /- \[x\] Manual bypass task/);
});

test('maintain prints deprecation warning and behaves like update --apply', () => {
  const dir = tmpdir();
  writeApplyFixture(dir);
  const result = runResult(['maintain', '--project-root', dir], dir);
  assert.match(result.stderr, /deprecated.*update --apply/);
  const content = fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8');
  assert.match(content, /- \[x\] Manual bypass task/, 'maintain must still flip like update --apply');
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
    '- [ ] Trivial pass <!-- rs:task=trivial-pass rs:kind=command rs:verified-by=node --version -->',
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
  // v0.13.1: use `node -e process.exit(1)` (allowlisted, non-zero exit) instead of `zzz-not-a-real-cmd`.
  const initial = [
    '<!-- rs:managed:start -->',
    '# Roadmap',
    '',
    '- [ ] Fails <!-- rs:task=fails rs:kind=command rs:verified-by=node -e process.exit(1) -->',
    '<!-- rs:managed:end -->',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), initial);
  const result = runResult(['verify', '--task', 'fails', '--run', '--project-root', dir], dir);
  assert.equal(result.status, 2);
  const content = fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8');
  assert.match(content, /- \[ \] Fails/);
});

// ── v0.13.1 C1: rs:verified-by allowlist + shell:false ──────────────────────

test('v0.13.1: verify --run rejects program not in allowlist (echo)', () => {
  const dir = tmpdir();
  const initial = [
    '<!-- rs:managed:start -->',
    '- [ ] Say hi <!-- rs:task=hi rs:kind=command rs:verified-by=echo hi -->',
    '<!-- rs:managed:end -->',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), initial);
  const result = runResult(['verify', '--task', 'hi', '--run', '--project-root', dir], dir);
  assert.equal(result.status, 1, 'echo is not in the v0.13.1 allowlist; must exit 1');
  assert.match(result.stderr, /not in the v0.13.1 allowlist/);
});

test('v0.13.1: verify --run refuses shell metacharacters (no injection)', () => {
  const dir = tmpdir();
  const pwnedMarker = path.join(dir, 'pwned');
  // Malicious verified-by tries to smuggle `;touch pwned` via shell. With shell:false
  // and allowlist enforcement, the payload never reaches a shell.
  const initial = [
    '<!-- rs:managed:start -->',
    `- [ ] Deploy <!-- rs:task=deploy rs:kind=command rs:verified-by=;touch ${pwnedMarker} -->`,
    '<!-- rs:managed:end -->',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), initial);
  const result = runResult(['verify', '--task', 'deploy', '--run', '--project-root', dir], dir);
  assert.equal(result.status, 1, 'must reject injection attempt');
  assert.equal(fs.existsSync(pwnedMarker), false, 'the injected touch payload must not execute');
});

test('v0.13.1: verify --run prints audit trail (+ program args) to stderr before executing', () => {
  const dir = tmpdir();
  const initial = [
    '<!-- rs:managed:start -->',
    '- [ ] Audit test <!-- rs:task=audit-test rs:kind=command rs:verified-by=node --version -->',
    '<!-- rs:managed:end -->',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), initial);
  const result = runResult(['verify', '--task', 'audit-test', '--run', '--project-root', dir], dir);
  assert.equal(result.status, 0);
  assert.match(result.stderr, /^\+ node --version/m, 'stderr must contain audit trail "+ node --version"');
});

test('v0.13.1: verify --task WITHOUT --run does not check allowlist (just prints "Would run")', () => {
  const dir = tmpdir();
  const initial = [
    '<!-- rs:managed:start -->',
    '- [ ] Would-be echo <!-- rs:task=w rs:kind=command rs:verified-by=echo hi -->',
    '<!-- rs:managed:end -->',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), initial);
  const out = run(['verify', '--task', 'w', '--project-root', dir], dir);
  assert.match(out, /Would run: echo hi/, 'preview mode must show the command without allowlist gate');
});

// ─── check-drift ─────────────────────────────────────────────────────────────

function writeDriftFixture(dir, northStar) {
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'test' }));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'app.js'), 'export default 1;\n');
  const config = { product: { name: 'test', northStar } };
  fs.writeFileSync(path.join(dir, 'roadmap-skill.config.json'), JSON.stringify(config));
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), '<!-- rs:managed:start -->\n<!-- rs:managed:end -->\n');
}

test('update --check-drift exits 0 when northStar aligns with detected repo signals', () => {
  const dir = tmpdir();
  // scanProject on this fixture detects languages=[JavaScript], modules=[app] → these tokens will match.
  writeDriftFixture(dir, 'javascript app');
  const result = runResult(['update', '--check-drift', '--project-root', dir], dir);
  assert.equal(result.status, 0, `expected exit 0, got ${result.status}. stdout=${result.stdout} stderr=${result.stderr}`);
  assert.match(result.stdout, /aligned/i);
});

test('update --check-drift exits 2 when northStar drifts from repo signals', () => {
  const dir = tmpdir();
  writeDriftFixture(dir, 'Ship kotlin gradle android compiler pipeline');
  const result = runResult(['update', '--check-drift', '--project-root', dir], dir);
  assert.equal(result.status, 2, `expected exit 2 on drift, got ${result.status}. stdout=${result.stdout}`);
  assert.match(result.stdout, /DRIFTED|Drifted/);
});

test('update --check-drift exits 1 when no northStar is configured', () => {
  const dir = tmpdir();
  writeDriftFixture(dir, '');
  const result = runResult(['update', '--check-drift', '--project-root', dir], dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /northStar/);
});

// ─── migrate-markers ─────────────────────────────────────────────────────────

test('migrate-markers rewrites rs:evidence=manual to rs:kind=manual', () => {
  const dir = tmpdir();
  const initial = [
    '<!-- rs:managed:start -->',
    '- [x] Legacy delete <!-- rs:task=drop-legacy rs:evidence=manual -->',
    '<!-- rs:managed:end -->',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), initial);
  const out = run(['migrate-markers', '--project-root', dir], dir);
  const content = fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8');
  assert.match(content, /rs:kind=manual/);
  assert.doesNotMatch(content, /rs:evidence=/);
  assert.match(out, /Migrated 1 marker/);
});

test('migrate-markers drops rs:no-test marker', () => {
  const dir = tmpdir();
  const initial = [
    '<!-- rs:managed:start -->',
    '- [ ] Autostart <!-- rs:task=autostart rs:no-test -->',
    '<!-- rs:managed:end -->',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), initial);
  run(['migrate-markers', '--project-root', dir], dir);
  const content = fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8');
  assert.doesNotMatch(content, /rs:no-test/);
  assert.match(content, /rs:task=autostart/);
});

test('migrate-markers is a no-op on already-migrated roadmap', () => {
  const dir = tmpdir();
  const initial = [
    '<!-- rs:managed:start -->',
    '- [x] Manual done <!-- rs:task=done rs:kind=manual -->',
    '<!-- rs:managed:end -->',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), initial);
  const out = run(['migrate-markers', '--project-root', dir], dir);
  assert.match(out, /Nothing to migrate/);
  assert.equal(fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8'), initial);
});

test('update --json on missing ROADMAP.md still emits parseable JSON error on stdout', () => {
  // v0.13.9: v0.13.8's guard broke v0.13.5's "--json always emits parseable JSON" invariant
  // by exiting before the JSON payload was written. This locks the fix.
  const dir = tmpdir();
  const res = runResult(['update', '--json', '--project-root', dir], dir);
  assert.equal(res.status, 1);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.error, 'roadmap-not-found');
  assert.match(parsed.message, /Run 'roadmapsmith init' first/);
  assert.equal(typeof parsed.file, 'string');
  assert.match(res.stderr, /No ROADMAP\.md found/);
});

test('update fails loud when no ROADMAP.md exists (does not silently create one)', () => {
  // v0.13.8 regression: pre-fix, running `update` in a directory without a
  // ROADMAP.md created a bare/empty one instead of pointing the user at `init`.
  const dir = tmpdir();
  // deliberately no ROADMAP.md, no package.json — pristine empty dir
  const res = runResult(['update', '--project-root', dir], dir);
  assert.equal(res.status, 1, 'must exit 1 on missing roadmap');
  assert.match(res.stderr, /No ROADMAP\.md found at .+ Run 'roadmapsmith init' first/);
  assert.equal(fs.existsSync(path.join(dir, 'ROADMAP.md')), false, 'must NOT create a file as side effect');
});

test('update --json without --audit still emits a valid JSON status on stdout', () => {
  // v0.13.5: pre-fix, `--json` without `--audit` printed nothing to stdout — --json is
  // supposed to always mean "machine-parseable output".
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), [
    '<!-- rs:managed:start -->',
    '## Phase',
    '- [x] Rollup only <!-- rs:kind=rollup -->',
    '<!-- rs:managed:end -->',
    ''
  ].join('\n'));
  const res = runResult(['update', '--json', '--project-root', dir], dir);
  const parsed = JSON.parse(res.stdout);
  assert.equal(typeof parsed.changed, 'boolean');
  assert.equal(typeof parsed.dryRun, 'boolean');
  assert.equal(typeof parsed.annotateOnly, 'boolean');
  assert.equal(typeof parsed.file, 'string');
});

test('update --audit --json keeps stdout as valid JSON (status goes to stderr)', () => {
  // Regression: pre-v0.13.4, "Updated <path> (annotate-only: ...)" leaked to stdout,
  // making `roadmapsmith update --audit --json | jq .` fail with "Unexpected token 'U'".
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), [
    '<!-- rs:managed:start -->',
    '## Phase',
    '- [x] Rollup only <!-- rs:kind=rollup -->',
    '<!-- rs:managed:end -->',
    ''
  ].join('\n'));
  const res = runResult(['update', '--audit', '--json', '--project-root', dir], dir);
  const parsed = JSON.parse(res.stdout);
  assert.ok(Array.isArray(parsed.checkedWithoutEvidence), 'stdout must be the audit JSON, not human status');
  assert.match(res.stderr, /Updated|No changes/, 'human status must be routed to stderr');
});

test('update prints "No changes" when the roadmap sync produces byte-identical output', () => {
  const dir = tmpdir();
  const initial = [
    '<!-- rs:managed:start -->',
    '## Phase',
    '- [x] Rollup only <!-- rs:kind=rollup -->',
    '<!-- rs:managed:end -->',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), initial);
  const firstOut = run(['update', '--project-root', dir], dir);
  assert.match(firstOut, /Updated|No changes/);
  const secondOut = run(['update', '--project-root', dir], dir);
  assert.match(secondOut, /No changes for /, 'second run should be a no-op with explicit "No changes"');
  assert.equal(fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8'), initial, 'no-op run must not touch the file');
});

test('migrate-markers --dry-run reports without writing', () => {
  const dir = tmpdir();
  const initial = [
    '<!-- rs:managed:start -->',
    '- [x] Legacy <!-- rs:task=legacy rs:evidence=manual -->',
    '<!-- rs:managed:end -->',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), initial);
  const out = run(['migrate-markers', '--dry-run', '--project-root', dir], dir);
  assert.match(out, /Would migrate 1 marker/);
  assert.equal(fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8'), initial);
});
