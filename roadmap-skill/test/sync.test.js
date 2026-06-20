'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseRoadmap } = require('../src/parser');
const { applySync } = require('../src/sync');
const { buildValidationContext, validateTasks, applyMinimumConfidence } = require('../src/validator');
const { loadConfig } = require('../src/config');

function setupFixture(name) {
  const source = path.resolve(__dirname, 'fixtures', name);
  const target = fs.mkdtempSync(path.join(os.tmpdir(), `roadmap-skill-${name}-`));
  fs.cpSync(source, target, { recursive: true });
  return target;
}

test('sync marks task complete when validation passes', () => {
  const projectRoot = setupFixture('node');
  const config = loadConfig({ projectRoot });
  const content = [
    '## Phase P0',
    '- [ ] App module <!-- rs:task=implement-app-module -->',
    ''
  ].join('\n');

  const parsed = parseRoadmap(content);
  const context = buildValidationContext(projectRoot, config, []);
  const results = validateTasks(parsed.tasks, context, config, []);
  const next = applySync(content, parsed.tasks, results);

  assert.match(next, /- \[x\] App module/);
  assert.doesNotMatch(next, /validation failed/);
});

test('sync resolves stale warnings with high-confidence evidence and records discovered files', () => {
  const projectRoot = setupFixture('generic');
  fs.mkdirSync(path.join(projectRoot, 'src', 'lib'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'src', '__tests__'), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, 'src', 'lib', 'notification.ts'),
    'export function sendNotification() {} export function notifySystem() {}\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(projectRoot, 'src', '__tests__', 'notification.test.ts'),
    "import { sendNotification } from '../lib/notification';\ntest('notification system sends delivery', () => sendNotification());\n",
    'utf8'
  );

  const config = loadConfig({ projectRoot });
  const content = [
    '## Phase P2',
    '- [ ] Add notification system <!-- rs:task=add-notifications -->',
    '  - ⚠️ attempted but validation failed: helper exists but no delivery mechanism',
    ''
  ].join('\n');
  const parsed = parseRoadmap(content);
  const context = buildValidationContext(projectRoot, config, []);
  const results = validateTasks(parsed.tasks, context, config, []);
  const next = applySync(content, parsed.tasks, results);

  assert.match(next, /- \[x\] Add notification system/);
  assert.match(next, /Evidence: src\/__tests__\/notification\.test\.ts, src\/lib\/notification\.ts/);
  assert.doesNotMatch(next, /⚠️ attempted but validation failed/);
});

test('sync writes one warning line when validation fails', () => {
  const projectRoot = setupFixture('node');
  fs.writeFileSync(path.join(projectRoot, 'src', 'payment.js'), 'function paymentModule() { return true; }\n', 'utf8');

  const config = loadConfig({ projectRoot });
  const content = [
    '## Phase P0',
    '- [ ] Implement payment module <!-- rs:task=implement-payment-module -->',
    ''
  ].join('\n');

  const parsed = parseRoadmap(content);
  const context = buildValidationContext(projectRoot, config, []);
  const results = validateTasks(parsed.tasks, context, config, []);

  const first = applySync(content, parsed.tasks, results);
  const secondParsed = parseRoadmap(first);
  const second = applySync(first, secondParsed.tasks, results);

  const warningMatches = second.match(/⚠️ no implementation evidence found yet/g) || [];
  assert.equal(warningMatches.length, 1);
  assert.match(second, /missing test evidence/);
});

test('sync reaches a fixed point after the first warning write', () => {
  const projectRoot = setupFixture('node');
  fs.writeFileSync(path.join(projectRoot, 'src', 'payment.js'), 'function paymentModule() { return true; }\n', 'utf8');

  const config = loadConfig({ projectRoot });
  const content = [
    '## Phase P0',
    '- [ ] Implement payment module <!-- rs:task=implement-payment-module -->',
    ''
  ].join('\n');

  const parsed = parseRoadmap(content);
  const context = buildValidationContext(projectRoot, config, []);
  const results = validateTasks(parsed.tasks, context, config, []);

  const first = applySync(content, parsed.tasks, results);
  const secondParsed = parseRoadmap(first);
  const secondResults = validateTasks(secondParsed.tasks, context, config, []);
  const second = applySync(first, secondParsed.tasks, secondResults);

  assert.equal(second, first);
});

test('sync inserts warning after Evidence lines when validation fails', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const content = [
    '## Phase P0',
    '- [ ] Implement inventory sync <!-- rs:task=inventory-sync -->',
    '  - Evidence: src/lib/inventory-sync.ts',
    ''
  ].join('\n');

  const parsed = parseRoadmap(content);
  const context = buildValidationContext(projectRoot, config, []);
  const results = validateTasks(parsed.tasks, context, config, []);
  const next = applySync(content, parsed.tasks, results);

  assert.match(next, /- \[ \] Implement inventory sync/);
  assert.match(next, /  - Evidence: src\/lib\/inventory-sync\.ts\n  - ⚠️ attempted but validation failed: evidence file\(s\) not found: src\/lib\/inventory-sync\.ts/);
});

test('sync keeps an honest no-evidence warning when a task has no concrete attempt signal', () => {
  const projectRoot = setupFixture('generic');
  fs.mkdirSync(path.join(projectRoot, 'src', 'app', 'api', 'mercadopago', 'preference'), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, 'src', 'app', 'api', 'mercadopago', 'preference', 'route.ts'),
    [
      "export async function POST() {",
      "  return fetch('https://api.mercadopago.com/checkout/preferences');",
      "}",
      ""
    ].join('\n'),
    'utf8'
  );

  const config = loadConfig({ projectRoot });
  const content = [
    '## Phase P2',
    '- [ ] Integración Mercado Pago Point (posnet) via SDK local <!-- rs:task=p2-mp-point-integration -->',
    ''
  ].join('\n');

  const parsed = parseRoadmap(content);
  const context = buildValidationContext(projectRoot, config, []);
  const results = validateTasks(parsed.tasks, context, config, []);

  const first = applySync(content, parsed.tasks, results);
  const secondParsed = parseRoadmap(first);
  const second = applySync(first, secondParsed.tasks, results);

  const warningMatches = second.match(/⚠️ no implementation evidence found yet/g) || [];
  assert.equal(warningMatches.length, 1);
  assert.match(second, /- \[ \] Integración Mercado Pago Point/);
  assert.match(second, /weak path-only evidence lacks content-specific token match/);
});

test('sync pipeline: low-confidence task stays unchecked when minimumConfidence is medium', () => {
  const content = '## Phase 1\n- [ ] implement xyzzy module\n';
  const tasks = [{ id: 'implement-xyzzy-module', text: 'implement xyzzy module', lineIndex: 1, checked: false }];
  const results = { 'implement-xyzzy-module': { passed: true, confidence: 'low', reasons: [] } };

  applyMinimumConfidence(results, 'medium');
  const next = applySync(content, tasks, results);

  assert.ok(next.includes('- [ ] implement xyzzy module'), 'Task should remain unchecked');
  assert.equal(results['implement-xyzzy-module'].passed, false);
});

test('sync pipeline: high-confidence task gets checked when minimumConfidence is medium', () => {
  const content = '## Phase 1\n- [ ] implement xyzzy module\n';
  const tasks = [{ id: 'implement-xyzzy-module', text: 'implement xyzzy module', lineIndex: 1, checked: false }];
  const results = { 'implement-xyzzy-module': { passed: true, confidence: 'high', reasons: [] } };

  applyMinimumConfidence(results, 'medium');
  const next = applySync(content, tasks, results);

  assert.ok(next.includes('- [x] implement xyzzy module'), 'Task should be checked');
});

test('sync rewrites stale attempted wording when the task has no real attempt signal', () => {
  const projectRoot = setupFixture('generic');
  fs.mkdirSync(path.join(projectRoot, 'src', 'app', 'api', 'mercadopago', 'preference'), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, 'src', 'app', 'api', 'mercadopago', 'preference', 'route.ts'),
    [
      "export async function POST() {",
      "  return fetch('https://api.mercadopago.com/checkout/preferences');",
      "}",
      ""
    ].join('\n'),
    'utf8'
  );

  const config = loadConfig({ projectRoot });
  const content = [
    '## Phase P2',
    '- [ ] Integración Mercado Pago Point (posnet) via SDK local <!-- rs:task=p2-mp-point-integration -->',
    '  - ⚠️ attempted but validation failed: weak path-only evidence lacks content-specific token match',
    ''
  ].join('\n');

  const parsed = parseRoadmap(content);
  const context = buildValidationContext(projectRoot, config, []);
  const results = validateTasks(parsed.tasks, context, config, []);
  const next = applySync(content, parsed.tasks, results);

  assert.match(next, /- \[ \] Integración Mercado Pago Point/);
  assert.doesNotMatch(next, /⚠️ attempted but validation failed/);
  assert.match(next, /⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match/);
});

test('sync reaches a fixed point after rewriting a legacy no-evidence warning prefix', () => {
  const projectRoot = setupFixture('generic');
  fs.mkdirSync(path.join(projectRoot, 'src', 'app', 'api', 'mercadopago', 'preference'), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, 'src', 'app', 'api', 'mercadopago', 'preference', 'route.ts'),
    [
      "export async function POST() {",
      "  return fetch('https://api.mercadopago.com/checkout/preferences');",
      "}",
      ""
    ].join('\n'),
    'utf8'
  );

  const config = loadConfig({ projectRoot });
  const content = [
    '## Phase P2',
    '- [ ] Integración Mercado Pago Point (posnet) via SDK local <!-- rs:task=p2-mp-point-integration -->',
    '  - ⚠️ attempted but validation failed: weak path-only evidence lacks content-specific token match',
    ''
  ].join('\n');

  const parsed = parseRoadmap(content);
  const context = buildValidationContext(projectRoot, config, []);
  const firstResults = validateTasks(parsed.tasks, context, config, []);
  const first = applySync(content, parsed.tasks, firstResults);

  const secondParsed = parseRoadmap(first);
  const secondResults = validateTasks(secondParsed.tasks, context, config, []);
  const second = applySync(first, secondParsed.tasks, secondResults);

  assert.doesNotMatch(first, /⚠️ attempted but validation failed/);
  assert.match(first, /⚠️ no implementation evidence found yet: weak path-only evidence lacks content-specific token match/);
  assert.equal(second, first);
});

test('sync preserves an already checked task with no evidence or path hints', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const content = [
    '## Milestones',
    '- [x] Foundation baseline complete milestone <!-- rs:task=milestone-v0-1 -->',
    ''
  ].join('\n');

  const parsed = parseRoadmap(content);
  const context = buildValidationContext(projectRoot, config, []);
  const results = validateTasks(parsed.tasks, context, config, []);
  const next = applySync(content, parsed.tasks, results);

  assert.equal(results['milestone-v0-1'].passed, true);
  assert.equal(results['milestone-v0-1'].confidence, 'low');
  assert.equal(results['milestone-v0-1'].preservedCheckedState, true);
  assert.match(next, /- \[x\] Foundation baseline complete milestone/);
});

test('sync preserves checked task when minimumConfidence is medium and state was preserved', () => {
  const content = '## Milestones\n- [x] Foundation baseline complete milestone <!-- rs:task=milestone-v0-1 -->\n';
  const tasks = [{
    id: 'milestone-v0-1',
    text: 'Foundation baseline complete milestone',
    lineIndex: 1,
    checked: true
  }];
  const results = {
    'milestone-v0-1': {
      passed: true,
      confidence: 'low',
      reasons: [],
      preservedCheckedState: true
    }
  };

  applyMinimumConfidence(results, 'medium');
  const next = applySync(content, tasks, results);

  assert.equal(results['milestone-v0-1'].passed, true);
  assert.match(next, /- \[x\] Foundation baseline complete milestone/);
});

test('applySync preserves more specific existing warning over generic new message', () => {
  const content = [
    '- [ ] Fix timeout in fetch handler <!-- rs:task=fix-timeout -->',
    '  - ⚠️ attempted but validation failed: missing referenced file(s): src/pos/page.tsx, missing test evidence'
  ].join('\n');
  const { parseRoadmap } = require('../src/parser');
  const parsed = parseRoadmap(content);
  const results = {
    'fix-timeout': {
      passed: false,
      attempted: true,
      reasons: ['validation failed']
    }
  };

  const next = applySync(content, parsed.tasks, results);

  assert.match(
    next,
    /missing referenced file\(s\): src\/pos\/page\.tsx/,
    'specific existing warning must be preserved when new message is more generic'
  );
});

test('applySync deduplicates warning reasons from a prior /api route sync run', () => {
  const projectRoot = setupFixture('warning-sync');
  const config = loadConfig({ projectRoot });
  const content = [
    '## Phase P1',
    '- [ ] Implement backup database module for GET /api/backup <!-- rs:task=implement-backup-module -->',
    '  - Evidence: src/missing-backup.js',
    '  - ⚠️ attempted but validation failed: evidence file(s) not found: src/missing-backup.js; evidence file(s) not found: src/missing-backup.js',
    ''
  ].join('\n');

  const parsed = parseRoadmap(content);
  const context = buildValidationContext(projectRoot, config, []);
  const results = validateTasks(parsed.tasks, context, config, []);
  const next = applySync(content, parsed.tasks, results);

  const warningMatches = next.match(/⚠️ attempted but validation failed/g) || [];
  const missingEvidenceMatches = next.match(/evidence file\(s\) not found: src\/missing-backup\.js/g) || [];

  assert.equal(warningMatches.length, 1);
  assert.equal(missingEvidenceMatches.length, 1);
  assert.doesNotMatch(next, /missing referenced file\(s\): \/api\/backup/);
});
