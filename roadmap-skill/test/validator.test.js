'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildValidationContext, validateTask } = require('../src/validator');
const { loadConfig } = require('../src/config');
const { walkFiles, detectWorkspaces } = require('../src/io');

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

test('natural-language slash pairs do not produce missing-file failures', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const pairs = [
    { id: 'start-end', text: 'managed block start/end marker format' },
    { id: 'input-output', text: 'support input/output streams' },
    { id: 'read-write', text: 'toggle read/write mode' },
    { id: 'before-after', text: 'flip before/after state' },
    { id: 'on-off', text: 'switch on/off feature' }
  ];

  for (const task of pairs) {
    const result = validateTask(task, context, config, []);
    const reasons = result.reasons.join('; ');
    assert.ok(
      !reasons.includes('missing referenced file'),
      `"${task.text}" should not produce a missing-file failure, got: ${reasons}`
    );
  }
});

test('unquoted paths with file extensions are still recognized', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  // src/parser.js does not exist in the generic fixture — should fail with missing-file, not silently pass
  const result = validateTask({ id: 'unquoted-path', text: 'Add parser at src/parser.js' }, context, config, []);
  assert.equal(result.passed, false);
  assert.match(result.reasons.join('; '), /missing referenced file.*src\/parser\.js/);
});

test('trailing punctuation is stripped from unquoted path tokens', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  // docs/usage.md does not exist in generic fixture; trailing dot must be stripped
  const dotResult = validateTask({ id: 'punct-dot', text: 'Update docs/usage.md.' }, context, config, []);
  const dotReasons = dotResult.reasons.join('; ');
  assert.ok(dotReasons.includes('missing referenced file'), `expected missing-file in: ${dotReasons}`);
  assert.ok(!dotReasons.includes('docs/usage.md.'), `trailing dot must be stripped, got: ${dotReasons}`);

  // .github/workflows/ci.yml with trailing paren — path still recognized, paren stripped
  const parenResult = validateTask({ id: 'punct-paren', text: 'Check .github/workflows/ci.yml)' }, context, config, []);
  const parenReasons = parenResult.reasons.join('; ');
  assert.ok(parenReasons.includes('missing referenced file'), `expected missing-file in: ${parenReasons}`);
  assert.ok(!parenReasons.includes('ci.yml)'), `trailing paren must be stripped, got: ${parenReasons}`);
});

test('detectWorkspaces detects npm workspace packages', () => {
  const projectRoot = setupFixture('monorepo');
  const files = walkFiles(projectRoot);
  const workspaces = detectWorkspaces(projectRoot, files);
  assert.deepEqual(workspaces, ['packages/auth', 'packages/core']);
});

test('validator finds test evidence inside workspace package', () => {
  const projectRoot = setupFixture('monorepo');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const result = validateTask(
    { id: 'workspace-auth', text: 'Implement auth workspace module' },
    context, config, []
  );
  assert.equal(result.evidence.test, true, 'test evidence must be found inside workspace package');
  assert.equal(result.requiresTest, true, 'requiresTest must remain true — no global weakening');
});
