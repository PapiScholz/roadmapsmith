'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildValidationContext, validateTask } = require('../src/validator');
const { loadConfig } = require('../src/config');

function setupFixture(name) {
  const source = path.resolve(__dirname, 'fixtures', name);
  const target = fs.mkdtempSync(path.join(os.tmpdir(), `roadmap-skill-${name}-`));
  fs.cpSync(source, target, { recursive: true });
  return target;
}

test('validator passes when code and tests exist for code task', () => {
  const projectRoot = setupFixture('node');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const result = validateTask({ id: 'implement-app-module', text: 'Implement app module' }, context, config, []);
  assert.equal(result.passed, true);
});

test('validator fails missing tests when framework is detected', () => {
  const projectRoot = setupFixture('node');
  fs.writeFileSync(path.join(projectRoot, 'src', 'billing.js'), 'function billingModule() { return true; }\n', 'utf8');

  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const result = validateTask({ id: 'implement-billing-module', text: 'Implement billing module' }, context, config, []);
  assert.equal(result.passed, false);
  assert.match(result.reasons.join('; '), /missing test evidence/);
});

test('validator checks explicit file existence hints', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const pass = validateTask({ id: 'artifact-path', text: 'Document artifact in `docs/artifact.txt`' }, context, config, []);
  assert.equal(pass.passed, true);

  const fail = validateTask({ id: 'missing-file', text: 'Create parser in `src/missing.js`' }, context, config, []);
  assert.equal(fail.passed, false);
  assert.match(fail.reasons.join('; '), /missing referenced file/);
});
