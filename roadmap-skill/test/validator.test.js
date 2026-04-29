'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildValidationContext, validateTask, auditValidation, applyMinimumConfidence, CONFIDENCE_RANK, extractTaskNamespace, isAcceptanceCriteria } = require('../src/validator');
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

test('canonical artifact heuristic: "Add SECURITY.md" detects SECURITY.md as artifact evidence', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const result = validateTask({ id: 'add-security', text: 'Add SECURITY.md' }, context, config, []);
  assert.equal(result.evidence.artifact, true, 'artifact evidence must be found for SECURITY.md');
  assert.equal(result.passed, true, 'task should pass when SECURITY.md exists');
  assert.ok(
    result.evidence.heuristicArtifacts.includes('SECURITY.md'),
    `expected SECURITY.md in heuristicArtifacts, got: ${JSON.stringify(result.evidence.heuristicArtifacts)}`
  );
  assert.equal(result.reasons.length, 0, 'passing task must have no reasons');
});

test('canonical artifact heuristic: "Add README file" detects README.md as artifact evidence', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const result = validateTask({ id: 'add-readme', text: 'Add README file' }, context, config, []);
  assert.equal(result.evidence.artifact, true, 'artifact evidence must be found for README.md');
  assert.equal(result.passed, true, 'task should pass when README.md exists');
  assert.ok(
    result.evidence.heuristicArtifacts.includes('README.md'),
    `expected README.md in heuristicArtifacts, got: ${JSON.stringify(result.evidence.heuristicArtifacts)}`
  );
});

test('canonical artifact heuristic: "Add billing module" does not false-positive on canonical files', () => {
  const projectRoot = setupFixture('generic');
  const config = loadConfig({ projectRoot });
  const context = buildValidationContext(projectRoot, config, []);

  const result = validateTask({ id: 'billing', text: 'Add billing module' }, context, config, []);
  assert.deepEqual(
    result.evidence.heuristicArtifacts,
    [],
    `billing module must not trigger canonical heuristic, got: ${JSON.stringify(result.evidence.heuristicArtifacts)}`
  );
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

test('auditValidation reports documentationOnlyEvidenceForImplementation', () => {
  const fakeResults = {
    'task-doconly': {
      passed: true, confidence: 'medium', reasons: [],
      evidence: { code: false, test: false, artifact: true },
      evidenceIsDocOnly: true,
    },
    'task-legit': {
      passed: true, confidence: 'high', reasons: [],
      evidence: { code: true, test: true, artifact: false },
      evidenceIsDocOnly: false,
    },
  };
  const fakeTasks = [
    { id: 'task-doconly', text: 'Implement classifier module', checked: true },
    { id: 'task-legit',   text: 'Implement app module',        checked: true },
  ];

  const audit = auditValidation(fakeTasks, fakeResults);
  assert.equal(audit.documentationOnlyEvidenceForImplementation.length, 1);
  assert.equal(audit.documentationOnlyEvidenceForImplementation[0].task.id, 'task-doconly');
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

test('tokens derived from referenced path hints do not score as code evidence', () => {
  // The bug: task text "projectType override in roadmap-skill.config.json" produces
  // path-derived tokens "roadmap" and "skill" from the standalone filename.
  // Those same tokens appear in source files that reference the same filename
  // (e.g. `const p = 'roadmap-skill.config.json'`), creating circular vocabulary.
  // Without filtering: "override" + "roadmap" + "skill" → score 3 ≥ threshold 3 → code evidence true.
  // After the fix: path-derived tokens excluded → only "projecttype" + "override" remain;
  // "override" appears once in loader.js → score 1 < threshold 2 → code evidence false.
  const projectRoot = setupFixture('node');
  const config = loadConfig({ projectRoot });

  // Source file with path-derived vocab ("roadmap-skill", "override") but NOT "projecttype".
  fs.writeFileSync(
    path.join(projectRoot, 'src', 'loader.js'),
    `'use strict';\n// Loads the roadmap-skill.config.json configuration override.\nfunction loadOverride(p) { return p; }\nmodule.exports = { loadOverride };\n`,
    'utf8'
  );

  // Config file exists so the path hint is satisfied — the test is specifically about
  // whether code evidence is false (not about the overall pass/fail of the task).
  fs.writeFileSync(
    path.join(projectRoot, 'roadmap-skill.config.json'),
    JSON.stringify({ roadmapProfile: 'compact' }),
    'utf8'
  );

  const context = buildValidationContext(projectRoot, config, []);

  // "roadmap-skill.config.json" is now detected as a standalone-file path hint.
  // pathDerivedTokens = {roadmap, skill, config, json}
  // code tokens after filtering = ["projecttype", "override"]
  // loader.js: "override" (score 1) < threshold 2 → no code evidence.
  const result = validateTask(
    { id: 'prof-ms-v0-8-config', text: 'projectType override in roadmap-skill.config.json' },
    context, config, []
  );

  assert.equal(
    result.evidence.code, false,
    '"roadmap" and "skill" are path-derived tokens — must not contribute to code evidence scoring'
  );
  // Confidence must be low: only file-presence evidence (no code/test/artifact).
  assert.equal(result.confidence, 'low', 'confidence must be low when only path hint evidence is present');
});
