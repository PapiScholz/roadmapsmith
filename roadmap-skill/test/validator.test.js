'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseRoadmap } = require('../src/parser');
const { buildValidationContext, validateTask, validateTasks, auditValidation, applyMinimumConfidence, CONFIDENCE_RANK, extractTaskNamespace, isAcceptanceCriteria } = require('../src/validator');
const { loadConfig } = require('../src/config');
const { walkFiles, detectWorkspaces } = require('../src/io');

function setupFixture(name) {
  const source = path.resolve(__dirname, 'fixtures', name);
  const target = fs.mkdtempSync(path.join(os.tmpdir(), `roadmap-skill-${name}-`));
  fs.cpSync(source, target, { recursive: true });
  return target;
}

test('validator checks explicit file existence hints', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  // Unchecked task: file exists but file-existence alone is not sufficient for unchecked tasks
  // (path hint shows WHERE to implement, not that implementation is done).
  const unchecked = validateTask({ id: 'artifact-path', text: 'Document artifact in `docs/artifact.txt`' }, context, config, []);
  assert.equal(unchecked.passed, false);
  assert.ok(unchecked.reasons.some((r) => r.includes('implementation location')), 'unchecked task must get location reason');

  // Already-checked task: file exists → preserved via shouldPreserveCheckedTask.
  const checked = validateTask({ id: 'artifact-path-done', text: 'Document artifact in `docs/artifact.txt`', checked: true }, context, config, []);
  assert.equal(checked.passed, true, 'checked task with found file must be preserved');
  assert.equal(checked.preservedCheckedState, true);

  // File does not exist → missing reason regardless of checked state.
  const fail = validateTask({ id: 'missing-file', text: 'Create parser in `src/missing.js`' }, context, config, []);
  assert.equal(fail.passed, false);
  assert.match(fail.reasons.join('; '), /missing referenced file/);
});

test('backticked HTTP routes, MIME types, and formulas do not become referenced file paths', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const cases = [
    { id: 'http-backtick', text: 'Handle `GET /api/backup` gracefully' },
    { id: 'mime-backtick', text: 'Support `image/png` uploads' },
    { id: 'formula-backtick', text: 'Explain `margen = (precioVenta - costPrice) / precioVenta * 100` in docs' }
  ];

  for (const task of cases) {
    const result = validateTask(task, context, config, []);
    assert.ok(
      !result.reasons.some((reason) => reason.includes('missing referenced file')),
      `"${task.text}" must not produce missing referenced file reasons, got: ${result.reasons.join('; ')}`
    );
  }
});

test('evidence with :line-range suffix resolves to the file on disk', () => {
  const projectRoot = setupFixture('generic');
  fs.mkdirSync(path.join(projectRoot, '.github', 'workflows'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, '.github', 'workflows', 'release.yml'), 'name: release\n', 'utf8');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const result = validateTask({
    id: 'ci-release',
    text: 'Wire Playwright smoke into release workflow',
    checked: true,
    evidenceLines: [{ text: '.github/workflows/release.yml:99-144 (Playwright install + smoke run)' }]
  }, context, config, []);

  assert.ok(
    !result.reasons.some((r) => /missing referenced file/.test(String(r))),
    `line-range suffix must be stripped before existence check, got: ${result.reasons.join('; ')}`
  );
});

test('rs:kind=rollup tasks pass with no evidence hunt', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const result = validateTask({
    id: 'milestone-x',
    text: 'Ship v0.2 milestone',
    checked: true,
    kind: 'rollup'
  }, context, config, []);

  assert.equal(result.passed, true);
  assert.equal(result.kind, 'rollup');
  assert.deepEqual(result.reasons, []);
});

test('rs:kind=command tasks pass on marker; audit surfaces verifiedBy', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const tasks = [{
    id: 'tsc-clean',
    text: 'TypeScript compila sin errores',
    checked: false,
    kind: 'command',
    verifiedBy: 'tsc -p tsconfig.json --noEmit'
  }];
  const results = validateTasks(tasks, context, config, []);
  const r = results['tsc-clean'];
  assert.equal(r.passed, true);
  assert.equal(r.kind, 'command');
  assert.equal(r.verifiedBy, 'tsc -p tsconfig.json --noEmit');

  const audit = auditValidation(tasks, results, { newlyUnchecked: [] });
  assert.equal(audit.checkedWithWeakEvidence.length, 0);
});

test('backticked HTTP request spans are not rescanned as standalone route hints', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);
  const result = validateTask(
    {
      id: 'commercial-licensing',
      text: 'Handle `POST /admin/license` `POST /trial` `POST /validate` gracefully'
    },
    context,
    config,
    []
  );

  assert.ok(
    !result.reasons.some((reason) => reason.includes('missing referenced file')),
    `backticked HTTP request spans must not leak route hints, got: ${result.reasons.join('; ')}`
  );
});

test('Next.js app-dir route-group aliases resolve /login and /setup without missing path or test warnings', () => {
  const projectRoot = setupFixture('node');
  fs.mkdirSync(path.join(projectRoot, 'src', 'app', '(auth)', 'login'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'src', 'app', '(auth)', 'setup'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'src', 'app', '(auth)', 'login', 'page.tsx'), 'export default function LoginPage() { return null; }\n', 'utf8');
  fs.writeFileSync(path.join(projectRoot, 'src', 'app', '(auth)', 'setup', 'page.tsx'), 'export default function SetupPage() { return null; }\n', 'utf8');

  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);
  const result = validateTask(
    {
      id: 'auth-redirects',
      text: 'Add redirect flow to /login and /setup'
    },
    context,
    config,
    []
  );

  assert.ok(!result.reasons.some((reason) => reason.includes('missing referenced file')), `unexpected missing path reason: ${result.reasons.join('; ')}`);
  assert.ok(!result.reasons.includes('missing test evidence'), `unexpected missing test evidence: ${result.reasons.join('; ')}`);
  assert.ok(result.reasons.some((r) => r.startsWith('file reference shows implementation location, not confirmed completion')));
});

test('Next.js nested static routes resolve to app-dir route files', () => {
  const projectRoot = setupFixture('generic');
  fs.mkdirSync(path.join(projectRoot, 'src', 'app', 'admin', 'license'), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, 'src', 'app', 'admin', 'license', 'route.ts'),
    'export async function POST() { return new Response(null, { status: 204 }); }\n',
    'utf8'
  );

  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);
  const result = validateTask(
    {
      id: 'admin-license-route',
      text: 'Add checks around /admin/license'
    },
    context,
    config,
    []
  );

  assert.ok(!result.reasons.some((reason) => reason.includes('missing referenced file')), `unexpected missing path reason: ${result.reasons.join('; ')}`);
});

test('external home-dir paths in task text do not trigger missing referenced file reasons', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);
  const result = validateTask(
    {
      id: 'design-plan-note',
      text: 'Document supporting notes in ~/.claude/plans/design.md'
    },
    context,
    config,
    []
  );

  assert.ok(!result.reasons.some((reason) => reason.includes('missing referenced file')), `unexpected missing path reason: ${result.reasons.join('; ')}`);
});

test('checked task without Evidence or path hints is preserved with low confidence', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);
  const result = validateTask(
    {
      id: 'milestone-v0-1',
      text: 'Foundation baseline complete milestone',
      checked: true
    },
    context,
    config,
    []
  );

  assert.equal(result.passed, true);
  assert.equal(result.confidence, 'preserved', 'v0.13.1: preservation surfaces as confidence=preserved (was low)');
  assert.equal(result.preservedCheckedState, true);
});

test('checked task with failed structural evidence is not preserved', () => {
  const projectRoot = setupFixture('namespace-vocab');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);
  const result = validateTask(
    {
      id: 'evh2-sample',
      text: 'validator hardening',
      checked: true
    },
    context,
    config,
    []
  );

  assert.equal(result.passed, false);
  assert.equal(result.evidence.structuralEvidence, false);
  assert.equal(result.preservedCheckedState, false);
});

test('v0.13.1: minimumConfidence DOES demote preserved checked tasks (regression guard for M4 fix)', () => {
  // Pre-v0.13.1 bug: `applyMinimumConfidence` skipped `preservedCheckedState` tasks entirely,
  // so `--minimum-confidence medium` could not reject a checked task with no evidence. That
  // made the "add --strict to reject preservation" promise a lie. v0.13.1 removes the skip;
  // preserved tasks have confidence 'preserved' (rank -1) and correctly fail any threshold.
  const results = {
    'milestone-v0-1': {
      passed: true,
      confidence: 'preserved',
      reasons: [],
      preservedCheckedState: true
    }
  };

  applyMinimumConfidence(results, 'medium');

  assert.equal(results['milestone-v0-1'].passed, false, 'preserved must fail --minimum-confidence medium');
  assert.ok(
    results['milestone-v0-1'].reasons.some((r) => /below required "medium"/.test(r)),
    'reason must explain the downgrade'
  );
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

test('applyMinimumConfidence: low confidence blocked by medium threshold', () => {
  const results = { 'task-a': { passed: true, confidence: 'low', reasons: [] } };
  applyMinimumConfidence(results, 'medium');
  assert.equal(results['task-a'].passed, false);
  assert.ok(results['task-a'].reasons.some((r) => r.includes('below required')));
});

test('applyMinimumConfidence: medium confidence blocked by high threshold', () => {
  const results = { 'task-b': { passed: true, confidence: 'medium', reasons: [] } };
  applyMinimumConfidence(results, 'high');
  assert.equal(results['task-b'].passed, false);
});

test('applyMinimumConfidence: high confidence passes high threshold', () => {
  const results = { 'task-c': { passed: true, confidence: 'high', reasons: [] } };
  applyMinimumConfidence(results, 'high');
  assert.equal(results['task-c'].passed, true);
});

test('applyMinimumConfidence: low allowed by low threshold', () => {
  const results = { 'task-d': { passed: true, confidence: 'low', reasons: [] } };
  applyMinimumConfidence(results, 'low');
  assert.equal(results['task-d'].passed, true);
});

test('applyMinimumConfidence: already-failed task stays failed without extra reason', () => {
  const results = { 'task-e': { passed: false, confidence: 'high', reasons: ['missing code evidence'] } };
  applyMinimumConfidence(results, 'low');
  assert.equal(results['task-e'].passed, false);
  assert.equal(results['task-e'].reasons.length, 1);
});

test('confidence is low when no evidence found (attempted flag does not boost confidence)', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const result = validateTask({ id: 'no-match', text: 'xyzzy quux frobnicate zorp' }, context, config, []);
  assert.equal(result.confidence, 'low');
});

// ── Regression: three-segment slash phrases must NOT become path hints ──────

test('three-segment slash phrases do not produce missing-file failures', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const phrases = [
    { id: 'code-test-artifact',       text: 'support code/test/artifact pipeline stages' },
    { id: 'build-test-deploy',        text: 'validate build/test/deploy workflow' },
    { id: 'filesystem-package-config',text: 'scan filesystem/package/config locations' },
    { id: 'main-exports-files',       text: 'inspect main/exports/files fields' },
    { id: 'client-server',            text: 'abstract client/server communication' },
    { id: 'request-response',         text: 'model request/response cycle' },
  ];

  for (const task of phrases) {
    const result = validateTask(task, context, config, []);
    const reasons = result.reasons.join('; ');
    assert.ok(
      !reasons.includes('missing referenced file'),
      `"${task.text}" must not produce a missing-file failure, got: ${reasons}`
    );
  }
});

// ── Regression: paths with file extensions still detected after rule removal ─

test('unquoted paths with file extensions are still treated as path hints after isLikelyPath fix', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const missingPaths = [
    { id: 'app-page',      text: 'Add page component at app/page.tsx' },
    { id: 'navbar',        text: 'Create Navbar at components/Navbar.tsx' },
    { id: 'ci-workflow',   text: 'Configure .github/workflows/ci.yml' },
    { id: 'docs-limits',   text: 'Document limits in docs/limitations.md' },
    { id: 'validator-src', text: 'Fix validator in roadmap-skill/src/validator/index.js' },
  ];

  for (const task of missingPaths) {
    const result = validateTask(task, context, config, []);
    const reasons = result.reasons.join('; ');
    assert.ok(
      reasons.includes('missing referenced file'),
      `"${task.text}" must produce a missing-file failure (path with extension or known root), got: ${reasons}`
    );
  }
});

// ── Regression: classifier/domain tasks must not pass via generic token overlap ─

test('implementation tasks with classifier/domain vocabulary do not pass via generic token overlap', () => {
  const projectRoot = setupFixture('node');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  // These features do not exist in the node fixture — only src/app.js and its test exist
  const unimplementedTasks = [
    { id: 'cls-1', text: 'Implement archetype detection from filesystem, package.json, and config evidence' },
    { id: 'cls-2', text: 'Repository classifier engine with confidence scoring' },
    { id: 'cls-3', text: 'Domain-specific roadmap profile driven by detected archetype' },
    { id: 'cls-4', text: 'Detect frontend-web signals from app pages and components directories' },
  ];

  for (const task of unimplementedTasks) {
    const result = validateTask(task, context, config, []);
    assert.ok(
      !result.passed,
      `"${task.text}" must not pass via generic token overlap — feature does not exist in fixture`
    );
  }
});

// ── Regression: test evidence requires import reference, not single-token overlap ─

test('test file counts as evidence only when it imports the relevant module', () => {
  const projectRoot = setupFixture('node');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  // app.test.js imports '../src/app' — should find test evidence for "app" tasks
  const appResult = validateTask(
    { id: 'app-impl', text: 'Implement app module' },
    context, config, []
  );
  assert.equal(
    appResult.evidence.test,
    true,
    'app.test.js imports src/app — must count as test evidence for app module task'
  );

  // app.test.js does NOT import a "billing" module — must not count as billing test evidence
  fs.writeFileSync(path.join(projectRoot, 'src', 'billing.js'), 'function billingEngine() {}\nmodule.exports = { billingEngine };\n', 'utf8');
  const contextAfter = buildValidationContext(projectRoot, config, []);
  const billingResult = validateTask(
    { id: 'billing-impl', text: 'Implement billing engine' },
    contextAfter, config, []
  );
  assert.equal(
    billingResult.evidence.test,
    false,
    'app.test.js does not import billing — must NOT count as test evidence for billing task'
  );
});

// ── Regression: auditValidation surfaces new evidence-quality categories ──────

test('auditValidation reports checkedWithWeakEvidence for low-confidence passed tasks', () => {
  const fakeResults = {
    'task-weak': { passed: true, confidence: 'low',  reasons: [], evidence: { code: false, test: false, artifact: true }, evidenceIsDocOnly: false },
    'task-ok':   { passed: true, confidence: 'high', reasons: [], evidence: { code: true,  test: true,  artifact: false }, evidenceIsDocOnly: false },
  };
  const fakeTasks = [
    { id: 'task-weak', text: 'Implement classifier', checked: true },
    { id: 'task-ok',   text: 'Implement app module', checked: true },
  ];

  const audit = auditValidation(fakeTasks, fakeResults);
  assert.equal(audit.checkedWithWeakEvidence.length, 1, 'must flag the low-confidence checked task');
  assert.equal(audit.checkedWithWeakEvidence[0].task.id, 'task-weak');
  assert.equal(audit.readyButUnchecked.length, 0);
});

test('auditValidation injects rs:kind=rollup hint when weak-evidence task had no evidence hunt', () => {
  const rollupLikeResult = { passed: true, confidence: 'low', reasons: [], attempted: false, evidence: { code: false, test: false, artifact: false } };
  const realImplResult  = { passed: true, confidence: 'low', reasons: ['token match below threshold'], attempted: true, evidence: { code: true, test: false, artifact: false } };
  const results = { 'looks-like-rollup': rollupLikeResult, 'real-impl-weak': realImplResult };
  const tasks = [
    { id: 'looks-like-rollup', text: 'Current state: CLI has 11 commands', checked: true },
    { id: 'real-impl-weak',    text: 'Implement classifier module',          checked: true }
  ];

  const audit = auditValidation(tasks, results);
  assert.equal(audit.checkedWithWeakEvidence.length, 2, 'both weak-evidence tasks flagged');
  assert.ok(
    rollupLikeResult.reasons.some((r) => r.includes('rs:kind=rollup')),
    'rollup-like task (no evidence hunt) must get the actionable hint'
  );
  assert.ok(
    !realImplResult.reasons.some((r) => r.includes('rs:kind=rollup')),
    'implementation task that failed detection must NOT get the rollup hint'
  );
});

// ── v0.13.1 C2: preservedCheckedState surfaces as confidence: 'preserved' ─────

test('v0.13.1: [x] task with no evidence surfaces as confidence: preserved (not low)', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);
  const result = validateTask(
    { id: 'fake', text: 'Implemented rate limiting on GraphQL resolvers', checked: true },
    context, config, []
  );
  assert.equal(result.passed, true, 'preservation still passes');
  assert.equal(result.confidence, 'preserved', 'confidence must be preserved, not low');
  assert.equal(result.preservedCheckedState, true);
  assert.ok(
    result.reasons.some((r) => /preserved.*strict.*rs:kind=manual/i.test(r)),
    'reasons must explain the preservation and how to opt out; got: ' + JSON.stringify(result.reasons)
  );
});

test('v0.13.1: auditValidation exposes preservedOnly bucket', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);
  const tasks = [
    { id: 'preserved-1', text: 'Implemented some hazy thing', checked: true },
    { id: 'preserved-2', text: 'Fixed another abstract concern', checked: true },
    { id: 'unchecked',   text: 'Do the thing later', checked: false }
  ];
  const results = validateTasks(tasks, context, config, []);
  const audit = auditValidation(tasks, results, { newlyUnchecked: [] });
  assert.equal(audit.preservedOnly.length, 2, 'both [x] tasks without evidence go in preservedOnly');
  const ids = audit.preservedOnly.map((item) => item.task.id).sort();
  assert.deepEqual(ids, ['preserved-1', 'preserved-2']);
});

test('v0.13.1: applyMinimumConfidence with "low" downgrades preserved tasks (rank -1 < low rank 0)', () => {
  const results = {
    'preserved-task': { passed: true, confidence: 'preserved', reasons: [], preservedCheckedState: true },
    'low-task':       { passed: true, confidence: 'low',       reasons: [], preservedCheckedState: false },
    'medium-task':    { passed: true, confidence: 'medium',    reasons: [], preservedCheckedState: false }
  };
  applyMinimumConfidence(results, 'low');
  assert.equal(results['preserved-task'].passed, false, 'preserved (rank -1) must be rejected by --minimum-confidence low');
  assert.equal(results['low-task'].passed, true, 'low (rank 0) meets --minimum-confidence low');
  assert.equal(results['medium-task'].passed, true, 'medium exceeds low');
});

// ── Structural evidence: namespace-vocab fixture ──────────────────────────────

test('extractTaskNamespace extracts known namespace prefixes', () => {
  assert.equal(extractTaskNamespace('cls-detect-frontend-web-signals'), 'cls');
  assert.equal(extractTaskNamespace('evh2-replace-naive-slash-path-regex'), 'evh2');
  assert.equal(extractTaskNamespace('dsg-add-web-landing-profile'), 'dsg');
  assert.equal(extractTaskNamespace('implement-app-module'), 'implement');
  assert.equal(extractTaskNamespace(null), null);
});

test('isAcceptanceCriteria detects phN-stN-exit task IDs', () => {
  assert.equal(isAcceptanceCriteria('cls-ph7-st1-exit-nandi-fixture-classified'), true);
  assert.equal(isAcceptanceCriteria('evh2-ph9-st1-exit-no-code-test-artifact-warning'), true);
  assert.equal(isAcceptanceCriteria('cls-detect-frontend-web-signals'), false);
  assert.equal(isAcceptanceCriteria('implement-app-module'), false);
});

test('cls-* tasks fail in namespace-vocab fixture: no classifier/ directory', () => {
  const projectRoot = setupFixture('namespace-vocab');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const clsTasks = [
    { id: 'cls-detect-frontend-web-signals', text: 'Detect frontend-web signals: app/, pages/, components/, next.config.*, vite.config.*, package.json deps (next, react, vue, svelte, astro)' },
    { id: 'cls-distinguish-landing-site',    text: 'Distinguish landing-site from generic frontend-web using route count and marketing copy signals' },
    { id: 'cls-add-confidence-scoring',      text: 'Add confidence scoring; fall back to unknown-generic when confidence is low' },
  ];

  for (const task of clsTasks) {
    const result = validateTask(task, context, config, []);
    assert.ok(
      !result.passed,
      `"${task.id}" must fail — no classifier implementation in namespace-vocab fixture, got reasons: ${result.reasons.join('; ')}`
    );
    assert.ok(
      result.reasons.some((r) => r.includes('namespace "cls"')),
      `"${task.id}" failure reason must mention namespace, got: ${result.reasons.join('; ')}`
    );
  }
});

test('dsg-* tasks fail in namespace-vocab fixture: no generator/domain/ directory', () => {
  const projectRoot = setupFixture('namespace-vocab');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const dsgTasks = [
    { id: 'dsg-add-web-landing-profile',      text: 'Add web/landing roadmap profile driven by detected archetype' },
    { id: 'dsg-generate-seo-metadata-tasks',   text: 'Generate SEO metadata tasks when archetype is frontend-web or landing-site' },
  ];

  for (const task of dsgTasks) {
    const result = validateTask(task, context, config, []);
    assert.ok(
      !result.passed,
      `"${task.id}" must fail — no domain-specific generator in namespace-vocab fixture`
    );
  }
});

test('evh2-* tasks fail in namespace-vocab fixture: no validator/ directory', () => {
  const projectRoot = setupFixture('namespace-vocab');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const evh2Task = { id: 'evh2-replace-naive-slash-path-regex', text: 'Replace naive slash-path regex with a stricter explicit path parser' };
  const result = validateTask(evh2Task, context, config, []);
  assert.ok(!result.passed, 'evh2 task must fail in namespace-vocab fixture — no validator/ directory');
});

test('cls-* task passes after classifier/index.js is added to namespace-vocab fixture', () => {
  const projectRoot = setupFixture('namespace-vocab');
  fs.mkdirSync(path.join(projectRoot, 'classifier'), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, 'classifier', 'index.js'),
    `'use strict';
function classifyRepository(signals) {
  if (signals.next || signals.react) return { archetype: 'frontend-web', confidence: 0.9 };
  return { archetype: 'unknown-generic', confidence: 0.3 };
}
module.exports = { classifyRepository };
`,
    'utf8'
  );

  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const result = validateTask(
    { id: 'cls-detect-frontend-web-signals', text: 'Detect frontend-web signals: app/, pages/, components/, next.config.*, vite.config.*, react deps' },
    context, config, []
  );
  assert.ok(
    result.evidence.structuralEvidence === true,
    `structural evidence must be true after classifier/index.js added, got: ${JSON.stringify(result.evidence.structuralEvidence)}`
  );
});

test('dsg-* task passes after generator/profiles/web.js is added to namespace-vocab fixture', () => {
  const projectRoot = setupFixture('namespace-vocab');
  fs.mkdirSync(path.join(projectRoot, 'generator', 'profiles'), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, 'generator', 'profiles', 'web.js'),
    `'use strict';
// Generates web/landing roadmap tasks driven by the detected archetype.
function generateWebLandingProfile(archetype, hints) {
  return { profile: 'web-landing', archetype, tasks: [] };
}
module.exports = { generateWebLandingProfile };
`,
    'utf8'
  );

  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const result = validateTask(
    { id: 'dsg-add-web-landing-profile', text: 'Add web/landing roadmap profile driven by detected archetype' },
    context, config, []
  );
  assert.ok(
    result.evidence.structuralEvidence === true,
    `structural evidence must be true after generator/profiles/web.js added`
  );
});

test('auditValidation reports checkedWithNoStructuralEvidence for namespace-failed tasks', () => {
  const fakeResults = {
    'cls-missing': {
      passed: false, confidence: 'low', reasons: ['namespace "cls" has no implementation files'],
      evidence: { code: false, test: false, artifact: false, structuralEvidence: false },
      evidenceIsDocOnly: false,
    },
    'implement-ok': {
      passed: true, confidence: 'high', reasons: [],
      evidence: { code: true, test: true, artifact: false, structuralEvidence: null },
      evidenceIsDocOnly: false,
    },
  };
  const fakeTasks = [
    { id: 'cls-missing',   text: 'Detect classifier signals', checked: true },
    { id: 'implement-ok',  text: 'Implement app module',      checked: true },
  ];

  const audit = auditValidation(fakeTasks, fakeResults);
  assert.equal(audit.checkedWithNoStructuralEvidence.length, 1, 'must flag the structural-mismatch checked task');
  assert.equal(audit.checkedWithNoStructuralEvidence[0].task.id, 'cls-missing');
});

// ── Fix: fixture files must not count as implementation evidence ──────────────

test('fixture files are excluded from the evidence pool', () => {
  // The namespace-vocab fixture contains vocabulary seeded specifically for testing
  // (web, landing, domain, profile, archetype). When validating against the real
  // project root those fixture files must NOT count as implementation evidence.
  const projectRoot = setupFixture('namespace-vocab');
  // Add an extra sub-fixtures dir to simulate a fixtures/ dir inside a project root
  const fixturesDir = path.join(projectRoot, 'fixtures', 'sub');
  fs.mkdirSync(fixturesDir, { recursive: true });
  fs.writeFileSync(
    path.join(fixturesDir, 'fake-impl.js'),
    `'use strict';\nfunction classifyRepository() { return 'frontend-web'; }\nmodule.exports = { classifyRepository };`,
    'utf8'
  );

  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  // The fake-impl.js lives under fixtures/ — it must be excluded from fileIndex
  const fixtureInIndex = context.fileIndex.some((f) => f.relativePath.includes('fixtures/'));
  assert.equal(fixtureInIndex, false, 'files under fixtures/ must not appear in the evidence fileIndex');
});

// ── Fix: path-derived tokens must not be reused as code evidence signals ─────

test('duplicate implicit task text gets independent validation results', () => {
  const projectRoot = setupFixture('generic');
  fs.mkdirSync(path.join(projectRoot, 'src', 'lib'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'src', 'lib', 'inventory-sync.ts'), 'export function syncInventory() {}\n', 'utf8');

  const content = [
    '## Phase P1',
    '- [ ] Implement inventory sync',
    '  - Evidence: src/lib/inventory-sync.ts',
    '- [ ] Implement inventory sync',
    '  - Evidence: src/lib/missing-inventory-sync.ts',
    ''
  ].join('\n');

  const parsed = parseRoadmap(content);
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);
  const results = validateTasks(parsed.tasks, context, config, []);

  assert.equal(parsed.tasks[0].id, 'implement-inventory-sync');
  assert.equal(parsed.tasks[1].id, 'implement-inventory-sync-2');
  assert.equal(results[parsed.tasks[0].id].passed, true);
  assert.equal(results[parsed.tasks[1].id].passed, false);
  assert.match(results[parsed.tasks[1].id].reasons.join('; '), /missing-inventory-sync\.ts/);
});

test('i18n and translation files are excluded from evidence file index', () => {
  const projectRoot = setupFixture('generic');
  fs.mkdirSync(path.join(projectRoot, 'src', 'i18n'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'src', 'lib', 'locale'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'src', 'i18n', 'es.json'), JSON.stringify({ inventory: 'Inventario', products: 'Productos' }), 'utf8');
  fs.writeFileSync(path.join(projectRoot, 'src', 'lib', 'locale', 'locales.ts'), "export const labels = { inventory: 'Inventario' };\n", 'utf8');

  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);
  const indexedPaths = context.fileIndex.map((f) => f.relativePath);
  assert.ok(!indexedPaths.some((p) => p.includes('/i18n/') || p.includes('/locale/')));
  assert.ok(!indexedPaths.some((p) => p.endsWith('es.json')));
});

// --- Regression: false negatives (tasks incorrectly unmarked) ---

test('Task text with /api/* glob does not produce "missing referenced file(s): /api/*"', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const result = validateTask(
    {
      id: 'prod-api-auth-middleware',
      text: 'Add requireAuth() to all routes /api/* — cookie HTTP-only plus requireAuth() on 14 endpoints',
      checked: true
    },
    context, config, []
  );

  assert.ok(!result.reasons.some((r) => r.includes('/api/*')), 'glob /api/* must not appear in reasons');
});

test('Checked task with path hint that exists is not blocked by missing test evidence', () => {
  const projectRoot = setupFixture('node');
  fs.mkdirSync(path.join(projectRoot, 'src', 'app', 'api', 'webhook'), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, 'src', 'app', 'api', 'webhook', 'route.ts'),
    'export async function POST(req) { /* signature check */ }\n',
    'utf8'
  );
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const result = validateTask(
    {
      id: 'prod-mp-webhook-signature',
      text: 'Validate webhook HMAC signature in src/app/api/webhook/route.ts',
      checked: true
    },
    context, config, []
  );

  assert.ok(!result.reasons.includes('missing test evidence'), 'path hint found in repo must suppress test requirement');
});

test('Path hint with line number (file.ts:NN) does not count as direct reference pass', () => {
  const projectRoot = setupFixture('node');
  fs.mkdirSync(path.join(projectRoot, 'src', 'app'), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, 'src', 'app', 'page.tsx'),
    'export default function Page() { return <div>hello</div>; }\n',
    'utf8'
  );
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  // Task text references the file with a line number (indicating WHERE to add code, not that it exists)
  const result = validateTask(
    {
      id: 'prod-login-loading-state',
      text: 'Add loading spinner to login page (src/app/page.tsx:43)',
      checked: false
    },
    context, config, []
  );

  assert.equal(result.passed, false, 'line-reference path hint must not pass the task');
});

test('Milestone with Blocked by: dep-a where dep-a is failing cannot pass', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const tasks = [
    { id: 'dep-a', text: 'Implement dep-a feature', checked: false, lineIndex: 0, lastChildLineIndex: 0, evidenceLines: [], warningLineIndex: null, warningText: null, noTest: false, indent: '', section: '' },
    { id: 'milestone-v1-0', text: 'Ship v1.0 Blocked by: dep-a', checked: true, lineIndex: 1, lastChildLineIndex: 1, evidenceLines: [], warningLineIndex: null, warningText: null, noTest: false, indent: '', section: '' }
  ];

  const { validateTasks } = require('../src/validator');
  const results = validateTasks(tasks, context, config, []);

  assert.equal(results['milestone-v1-0'].passed, false, 'milestone must fail when dep-a is incomplete');
  assert.ok(results['milestone-v1-0'].reasons.some((r) => r.includes('dep-a')));
});

test('default excluded template directories and configured skillsDir are skipped by validator index', () => {
  const projectRoot = setupFixture('generic');
  fs.mkdirSync(path.join(projectRoot, '.claude', 'skills'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, '.agent', 'skills'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'roadmap-skill', 'src'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'custom-skills', 'team'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, '.claude', 'skills', 'prompt.md'), 'sync roadmap prompt', 'utf8');
  fs.writeFileSync(path.join(projectRoot, '.agent', 'skills', 'prompt.md'), 'sync roadmap prompt', 'utf8');
  fs.writeFileSync(path.join(projectRoot, 'roadmap-skill', 'src', 'index.js'), 'module.exports = {};', 'utf8');
  fs.writeFileSync(path.join(projectRoot, 'custom-skills', 'team', 'SKILL.md'), '# Skill', 'utf8');

  const config = loadConfig({ projectRoot });
  config.skillsDir = 'custom-skills';
  const context = buildValidationContext(projectRoot, config, []);
  const indexedPaths = context.fileIndex.map((f) => f.relativePath);

  assert.ok(!indexedPaths.some((p) => p.startsWith('.claude/')));
  assert.ok(!indexedPaths.some((p) => p.startsWith('.agent/')));
  assert.ok(!indexedPaths.some((p) => p.startsWith('custom-skills/')));
  // roadmap-skill/ is NOT hardcoded-excluded anymore (v0.12.1 fix): monorepo layouts
  // where the package lives in a subdir need those files indexed so Evidence: lines
  // pointing at them can be validated.
  assert.ok(indexedPaths.some((p) => p.startsWith('roadmap-skill/')), 'roadmap-skill/ files must be indexed for monorepo evidence to work');
});

// --- Regression: v0.9.10 false-positive and false-negative fixes ---

test('Bare "/" from prose separator (e.g. "API / ESC-POS") is not extracted as path hint', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const result = validateTask(
    {
      id: 'p1-thermal-printer',
      text: 'Impresión de tickets en impresora térmica 80mm (Web Serial API / ESC-POS)',
      checked: false
    },
    context, config, []
  );

  assert.ok(!result.reasons.some((r) => r.includes('"/"') || r === 'missing referenced file(s): /'), 'bare "/" must not appear in reasons');
});

test('Backtick-quoted property access like err.message is not extracted as a path hint', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const result = validateTask(
    {
      id: 'prod-sanitize-error-messages',
      text: 'Sanitize error responses: never expose `err.message` or `error.stack` to the client',
      checked: false
    },
    context, config, []
  );

  assert.ok(!result.reasons.some((r) => r.includes('err.message') || r.includes('error.stack')), 'property access must not appear in missing-file reasons');
});

test('Unchecked task with pure path hint (file exists, no impl evidence) does not auto-pass', () => {
  const projectRoot = setupFixture('node');
  fs.mkdirSync(path.join(projectRoot, 'src', 'lib'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'src', 'lib', 'db.ts'), 'export function query() {}\n', 'utf8');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const result = validateTask(
    {
      id: 'prod-db-corruption-recovery',
      text: 'Add fallback recovery in src/lib/db.ts when database corruption is detected',
      checked: false
    },
    context, config, []
  );

  assert.equal(result.passed, false, 'unchecked task must not pass just because referenced file exists');
  assert.ok(result.reasons.some((r) => r.includes('implementation location')), 'reason must clarify that path hint shows location not completion');
});

// --- Regression: v0.9.11 false-positive fixes ---

// Causa 1: Blocked-by in child bullet (not inline in task text)
// The milestone is [x] (would be preserved as passed), but its child-bullet declares
// "Blocked by: child-dep-task" and child-dep-task is still [ ] → post-pass must fail it.
test('Milestone with Blocked-by in child bullet stays failed when dep is incomplete', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const { parseRoadmap } = require('../src/parser');
  const { validateTasks } = require('../src/validator');
  const content = [
    '## Milestones',
    '- [ ] Dependency task <!-- rs:task=child-dep-task -->',
    '- [x] v1.0 release <!-- rs:task=child-milestone-v1 -->',
    '  - Blocked by: child-dep-task',
    ''
  ].join('\n');
  const { tasks } = parseRoadmap(content);

  const results = validateTasks(tasks, context, config, []);
  assert.equal(results['child-milestone-v1'].passed, false, 'milestone must fail when child-bullet Blocked-by dep is incomplete');
  assert.ok(results['child-milestone-v1'].reasons.some((r) => r.includes('child-dep-task')), 'reason must name the blocking dep');
});

// Causa 3a: action-verb task with path hint + code tokens — stays unchecked without Evidence line
// Causa 3b: same action-verb task WITH Evidence line passes
test('Action-verb task WITH Evidence line passes despite no test evidence', () => {
  const projectRoot = setupFixture('generic');
  fs.mkdirSync(path.join(projectRoot, 'src', 'lib'), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, 'src', 'lib', 'db.ts'),
    'export function query() { return prisma.findMany(); }\nfunction handleFallback() { /* recovery logic */ }\n',
    'utf8'
  );

  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const result = validateTask(
    {
      id: 'prod-db-recovery',
      text: 'Agregar fallback recovery en src/lib/db.ts cuando falla Prisma',
      checked: false,
      evidenceLines: [{ text: 'src/lib/db.ts' }]
    },
    context, config, []
  );
  assert.equal(result.passed, true, 'action-verb task WITH Evidence line must pass');
  assert.ok(!result.reasons.some((r) => r.includes('implementation task requires')), 'implementation task reason must not appear when Evidence line is present');
});

test('Action task WITH Evidence line is marked complete', () => {
  const projectRoot = setupFixture('generic');
  fs.mkdirSync(path.join(projectRoot, 'inventory'), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, 'inventory', 'page.tsx'),
    'export function InventoryPage() { mostrar(ajuste); inventario.push(confirmacion); }\n',
    'utf8'
  );
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const result = validateTask(
    {
      id: 'prod-inventory-warning',
      text: 'Mostrar confirmación antes de ajuste de inventario en inventory/page.tsx',
      checked: false,
      evidenceLines: [{ text: 'inventory/page.tsx' }]
    },
    context, config, []
  );
  assert.equal(result.passed, true, 'action task WITH Evidence line must pass');
  assert.ok(!result.reasons.some((r) => r.includes('implementation task requires')));
});

test('Non-action task with token match can pass without Evidence line', () => {
  const projectRoot = setupFixture('generic');
  fs.mkdirSync(path.join(projectRoot, 'inventory'), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, 'inventory', 'page.tsx'),
    'export function InventoryPage() { return stock > 0 ? "ok" : "ajuste"; }\n',
    'utf8'
  );
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const result = validateTask(
    { id: 'stock-management', text: 'Stock management module in inventory/page.tsx', checked: false },
    context, config, []
  );
  assert.ok(!result.reasons.some((r) => r.includes('implementation task requires')), 'non-action task must not be blocked by implementation gate');
});

test('/api/* HTTP route paths do not produce missing-file failures', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const routes = [
    { id: 'api-backup',    text: 'Add error handling to /api/backup route' },
    { id: 'api-products',  text: 'Validate /api/products/[sku] endpoint' },
    { id: 'api-dashboard', text: 'Secure /api/dashboard with auth middleware' },
  ];
  for (const task of routes) {
    const result = validateTask(task, context, config, []);
    const reasons = result.reasons.join('; ');
    assert.ok(
      !reasons.includes('missing referenced file'),
      `"${task.text}" must not produce missing-file failure for HTTP route, got: ${reasons}`
    );
  }
});

test('human-attested tasks bypass the evidence hunt (rs:kind=manual, strikethrough N/A)', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  // Delete/cleanup task: path is referenced but must NOT exist. User attests with rs:kind=manual.
  const deleteTask = validateTask(
    { id: 'delete-hogar', text: 'Eliminar directorios `src/app/hogar/blog` y `src/app/hogar/videos`', checked: true, kind: 'manual' },
    context, config, []
  );
  assert.equal(deleteTask.passed, true, 'kind=manual must pass without hunting for files');
  assert.equal(deleteTask.humanVerified, true);
  assert.equal(deleteTask.confidence, 'manual');
  assert.deepEqual(deleteTask.reasons, []);

  // Declined / N/A task: strikethrough in body sets declined:true on the parsed task.
  const declinedTask = validateTask(
    { id: 'sql-migration', text: '~~Migracion SQL aditiva~~ **N/A** — flujo email-only', checked: true, declined: true },
    context, config, []
  );
  assert.equal(declinedTask.passed, true, 'declined tasks must pass');
  assert.equal(declinedTask.humanVerified, true);

  // Control: same delete text without attestation still fails (baseline regression guard).
  const unattested = validateTask(
    { id: 'delete-baseline', text: 'Eliminar directorios `src/app/hogar/blog` y `src/app/hogar/videos`', checked: true },
    context, config, []
  );
  assert.equal(unattested.passed, false, 'without attestation, missing-file check still fires');
});

test('deletion keyword: task passes when the named file is absent from the file index', () => {
  const fileIndex = [{ relativePath: 'src/keeper.js', content: '', ext: '.js', isTestFile: false }];
  const result = validateTask(
    { id: 'delete-old', text: 'Legacy shim removed at `src/legacy/shim.js`', checked: true },
    fileIndex,
    {},
    []
  );
  assert.equal(result.passed, true);
  assert.equal(result.deletionTask, true);
  assert.match(result.discoveredEvidence || '', /verified absent/);
});

test('deletion keyword: task fails when the named file is still present', () => {
  const fileIndex = [{ relativePath: 'src/legacy/shim.js', content: '', ext: '.js', isTestFile: false }];
  const result = validateTask(
    { id: 'delete-old', text: 'Legacy shim eliminado en `src/legacy/shim.js`', checked: true },
    fileIndex,
    {},
    []
  );
  assert.equal(result.passed, false);
  assert.equal(result.deletionTask, true);
  assert.ok(result.reasons.some((r) => /still present/.test(r)), 'reason names the surviving file');
});

test('pathAliases: monorepo prefix in task text resolves to real file under aliased subdirectory', () => {
  const fileIndex = [
    { relativePath: 'apps/web/src/app/dashboard/familias/page.tsx', content: '', ext: '.tsx', isTestFile: false }
  ];
  const config = { pathAliases: { '/dashboard/': 'apps/web/src/app/dashboard/' } };
  const results = validateTasks(
    [{ id: 'dash', text: 'Ship familias route in `/dashboard/familias/page.tsx`', checked: true }],
    fileIndex,
    config,
    []
  );
  const result = results.dash;
  assert.equal(result.passed, true);
  assert.equal(result.preservedCheckedState, true);
});

test('parseRoadmap surfaces declined and kind flags end-to-end', () => {
  const { parseRoadmap: parse } = require('../src/parser');
  const content = [
    '<!-- rs:managed:start -->',
    '- [x] Eliminar `src/app/hogar/blog` <!-- rs:task=delete-hogar rs:kind=manual -->',
    '- [x] ~~Feature X~~ **N/A** — descartado <!-- rs:task=declined-x -->',
    '- [x] Normal task <!-- rs:task=normal-1 -->',
    '<!-- rs:managed:end -->',
    ''
  ].join('\n');

  const tasks = parse(content).tasks;
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));

  assert.equal(byId['delete-hogar'].kind, 'manual');
  assert.equal(byId['delete-hogar'].declined, false);
  assert.equal(byId['declined-x'].declined, true);
  assert.equal(byId['declined-x'].kind, null);
  assert.equal(byId['normal-1'].declined, false);
  assert.equal(byId['normal-1'].kind, null);
});

test('validateTasks assigns cause taxonomy on failing results', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const content = [
    '## Phase P0',
    '- [ ] task pointing at missing file `src/does/not/exist.ts` <!-- rs:task=path-miss -->',
    '- [ ] `src/nowhere/gone.ts` deleted from repo <!-- rs:task=deletion-fail -->',
    '- [ ] some very vague task with no signals whatsoever <!-- rs:task=no-evidence -->',
    ''
  ].join('\n');

  const parsed = parseRoadmap(content);
  const context = buildValidationContext(projectRoot, config, []);
  const results = validateTasks(parsed.tasks, context, config, []);

  assert.equal(results['path-miss'].cause, 'path-mismatch', 'missing file → path-mismatch');
  assert.equal(results['no-evidence'].cause, 'no-evidence', 'no signals → no-evidence');
});

test('validation reasons include actionable hints (pathAliases + evidence + evidence-only)', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const content = [
    '## Phase P0',
    '- [ ] Missing file `src/does/not/exist.ts` <!-- rs:task=hint-a -->',
    '- [ ] Vague future work <!-- rs:task=hint-b -->',
    ''
  ].join('\n');

  const parsed = parseRoadmap(content);
  const context = buildValidationContext(projectRoot, config, []);
  const results = validateTasks(parsed.tasks, context, config, []);

  assert.match(
    results['hint-a'].reasons.join(' | '),
    /if this is a monorepo, add pathAliases in roadmap-skill\.config\.json/
  );
  assert.match(
    results['hint-b'].reasons.join(' | '),
    /roadmapsmith update --task <id> --evidence <path>/
  );
});
