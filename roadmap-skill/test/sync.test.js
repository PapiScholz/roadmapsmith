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
    '- [ ] Implement app module <!-- rs:task=implement-app-module -->',
    ''
  ].join('\n');

  const parsed = parseRoadmap(content);
  const context = buildValidationContext(projectRoot, config, []);
  const results = validateTasks(parsed.tasks, context, config, []);
  const next = applySync(content, parsed.tasks, results);

  assert.match(next, /- \[x\] Implement app module/);
  assert.doesNotMatch(next, /validation failed/);
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

  const warningMatches = second.match(/⚠️ attempted but validation failed/g) || [];
  assert.equal(warningMatches.length, 1);
  assert.match(second, /missing test evidence/);
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
