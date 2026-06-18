'use strict';

const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const {
  PACKAGE_ROOT,
  renderReport,
  runGateDefinition
} = require('../scripts/pre-push-gate');

const SCRIPT_PATH = path.resolve(__dirname, '..', 'scripts', 'pre-push-gate.js');

function runPlan(mode) {
  const raw = execFileSync(process.execPath, [SCRIPT_PATH, mode, '--plan', '--json'], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8'
  });
  return JSON.parse(raw);
}

test('qa-regression plan exposes the full-suite and packed-surface checks', () => {
  const report = runPlan('qa-regression');

  assert.equal(report.gate, 'qa-regression');
  assert.equal(report.status, 'planned');
  assert.deepEqual(report.checks.map((check) => check.id), ['full-test-suite', 'packed-surface']);
  assert.match(report.checks[0].command, /scripts[\/\\]run-tests\.js/);
  assert.match(report.checks[1].command, /scripts\/verify-pack-surface\.js/);
});

test('functional-smoke plan covers preserve safety, slash flows, and launcher smoke', () => {
  const report = runPlan('functional-smoke');
  const ids = report.checks.map((check) => check.id);

  assert.equal(report.gate, 'functional-smoke');
  assert.equal(report.status, 'planned');
  assert.deepEqual(ids, [
    'maintain-dry-run-electron',
    'doctor-json',
    'direct-slash-update-dry-run',
    'generate-refuses-without-full-regen',
    'generate-full-regen-dry-run',
    'launcher-palette',
    'legacy-router-validate'
  ]);
  assert.match(report.checks.find((check) => check.id === 'direct-slash-update-dry-run').command, /\/roadmap-update/);
  assert.match(report.checks.find((check) => check.id === 'legacy-router-validate').command, /\/roadmap-sync validate/);
});

test('all plan aggregates the two required subagent gates under the broad profile', () => {
  const report = runPlan('all');

  assert.equal(report.gate, 'pre-push');
  assert.equal(report.profile, 'Amplio');
  assert.deepEqual(report.subgates.map((subgate) => subgate.gate), ['qa-regression', 'functional-smoke']);
});

test('runGateDefinition records failed checks without suppressing later checks', () => {
  const report = runGateDefinition({
    gate: 'qa-regression',
    profile: 'Amplio',
    summary: 'test gate',
    residualRisks: [],
    unvalidatedSurfaces: [],
    checks: [
      {
        id: 'first-fails',
        label: 'First check fails',
        command: process.execPath,
        args: ['-e', 'process.exit(3)'],
        cwd: PACKAGE_ROOT
      },
      {
        id: 'second-passes',
        label: 'Second check passes',
        command: process.execPath,
        args: ['-e', "process.stdout.write('ok')"],
        cwd: PACKAGE_ROOT,
        validate(result) {
          assert.equal(result.stdout, 'ok');
        }
      }
    ]
  });

  assert.equal(report.status, 'fail');
  assert.deepEqual(report.checks.map((check) => check.status), ['fail', 'pass']);
  assert.match(report.checks[0].error, /expected 0/i);
  assert.equal(report.checks[0].exitCode, 3);
  assert.equal(report.checks[1].exitCode, 0);

  const rendered = renderReport(report);
  assert.match(rendered, /FAIL First check fails/);
  assert.match(rendered, /PASS Second check passes/);
  assert.match(rendered, /Error: first-fails exited with 3; expected 0\./);
});

test('runGateDefinition aggregate mode preserves sibling subgate results when one fails', () => {
  const report = runGateDefinition({
    gate: 'pre-push',
    profile: 'Amplio',
    summary: 'aggregate test gate',
    subgates: [
      {
        gate: 'qa-regression',
        profile: 'Amplio',
        summary: 'failing subgate',
        residualRisks: [],
        unvalidatedSurfaces: [],
        checks: [
          {
            id: 'fails',
            label: 'Fails',
            command: process.execPath,
            args: ['-e', "throw new Error('boom')"],
            cwd: PACKAGE_ROOT
          }
        ]
      },
      {
        gate: 'functional-smoke',
        profile: 'Amplio',
        summary: 'passing subgate',
        residualRisks: [],
        unvalidatedSurfaces: [],
        checks: [
          {
            id: 'passes',
            label: 'Passes',
            command: process.execPath,
            args: ['-e', "process.stdout.write('ok')"],
            cwd: PACKAGE_ROOT
          }
        ]
      }
    ]
  });

  assert.equal(report.status, 'fail');
  assert.deepEqual(report.subgates.map((subgate) => subgate.status), ['fail', 'pass']);
  assert.match(report.subgates[0].checks[0].error, /expected 0/i);
  assert.equal(report.subgates[1].checks[0].status, 'pass');
});
