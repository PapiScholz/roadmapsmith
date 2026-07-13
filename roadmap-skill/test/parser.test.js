'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseRoadmap, upsertManagedBlock } = require('../src/parser');

test('parseRoadmap extracts tasks and warning lines', () => {
  const content = [
    '## Phase P0',
    '- [ ] Implement CLI parser <!-- rs:task=implement-cli-parser -->',
    '  - ⚠️ attempted but validation failed: missing tests',
    ''
  ].join('\n');

  const parsed = parseRoadmap(content);
  assert.equal(parsed.tasks.length, 1);
  assert.equal(parsed.tasks[0].id, 'implement-cli-parser');
  assert.equal(parsed.tasks[0].warningText, 'missing tests');
});

test('parseRoadmap associates Evidence lines and delayed warning with the same task', () => {
  const content = [
    '## Phase P0',
    '- [ ] Implement thermal printer support <!-- rs:task=thermal-printer -->',
    '  - Evidence: src/lib/thermal-printer.ts, src/__tests__/thermal-printer.test.ts',
    '  - ⚠️ attempted but validation failed: missing test evidence',
    ''
  ].join('\n');

  const parsed = parseRoadmap(content);
  assert.equal(parsed.tasks.length, 1);
  assert.equal(parsed.tasks[0].evidenceLines.length, 1);
  assert.equal(parsed.tasks[0].evidenceLines[0].text, 'src/lib/thermal-printer.ts, src/__tests__/thermal-printer.test.ts');
  assert.equal(parsed.tasks[0].warningText, 'missing test evidence');
  assert.equal(parsed.tasks[0].lastChildLineIndex, 3);
});

test('parseRoadmap associates deterministic verification metadata, generated recipes, and explicit pending items', () => {
  const content = [
    '## Phase P0',
    '- [ ] Protect login submit <!-- rs:task=login-submit -->',
    '  - Verify: kind=behavior; source=src/login.tsx; test=src/__tests__/login.test.tsx; case=disables submit; trigger=fireEvent.click; assertion=toBeDisabled',
    '  - Test evidence: file=src/__tests__/login.test.tsx; case=disables submit; status=PASS; verifiedAt=2026-06-20T12:00:00.000Z',
    '  - Verification recipe: src/login.tsx:12 inspect disabled={isSubmitting}',
    '  - ❌ Pending: verify keyboard submit',
    ''
  ].join('\n');

  const task = parseRoadmap(content).tasks[0];
  assert.equal(task.verifyLines[0].text.includes('kind=behavior'), true);
  assert.equal(task.testEvidenceLines.length, 1);
  assert.equal(task.verificationRecipeLineIndex, 4);
  assert.deepEqual(task.explicitPendingItems.map((item) => item.text), ['Pending: verify keyboard submit']);
});

test('parseRoadmap normalizes legacy and current warning prefixes to the same warning text', () => {
  const content = [
    '## Phase P0',
    '- [ ] Legacy warning task <!-- rs:task=legacy-warning -->',
    '  - ⚠️ attempted but validation failed: missing test evidence',
    '- [ ] Current warning task <!-- rs:task=current-warning -->',
    '  - ⚠️ no implementation evidence found yet: missing test evidence',
    ''
  ].join('\n');

  const parsed = parseRoadmap(content);
  assert.equal(parsed.tasks.length, 2);
  assert.equal(parsed.tasks[0].warningText, 'missing test evidence');
  assert.equal(parsed.tasks[1].warningText, 'missing test evidence');
});

test('parseRoadmap throws on deprecated rs:evidence= marker with migrate hint', () => {
  const content = '- [x] Eliminar `src/legacy.js` <!-- rs:task=drop-legacy rs:evidence=manual -->';
  assert.throws(
    () => parseRoadmap(content),
    /rs:evidence=.*migrate-markers.*rs:kind=manual/s
  );
});

test('parseRoadmap throws on deprecated rs:no-test marker with migrate hint', () => {
  const content = '- [ ] Implement windows autostart <!-- rs:task=p0-windows-autostart rs:no-test -->';
  assert.throws(
    () => parseRoadmap(content),
    /rs:no-test.*migrate-markers/s
  );
});

test('parseRoadmap throws on unknown rs:kind= value listing valid options', () => {
  const content = '- [ ] Weird task <!-- rs:task=weird rs:kind=bogus -->';
  assert.throws(
    () => parseRoadmap(content),
    /rs:kind=bogus.*rollup, command, manual/s
  );
});

test('parseRoadmap disambiguates repeated implicit task text while preserving explicit IDs', () => {
  const content = [
    '- [ ] Implement billing module',
    '- [ ] Implement billing module',
    '- [ ] Implement billing module <!-- rs:task=explicit-billing -->',
    '- [ ] Implement billing module',
    ''
  ].join('\n');

  const parsed = parseRoadmap(content);
  assert.deepEqual(parsed.tasks.map((task) => task.id), [
    'implement-billing-module',
    'implement-billing-module-2',
    'explicit-billing',
    'implement-billing-module-3'
  ]);
});

test('parseRoadmap reports managed block range', () => {
  const content = [
    '# Notes',
    '<!-- rs:managed:start -->',
    '## Phase P0',
    '- [ ] Implement CLI parser <!-- rs:task=implement-cli-parser -->',
    '<!-- rs:managed:end -->',
    ''
  ].join('\n');

  const parsed = parseRoadmap(content);
  assert.equal(parsed.hasManagedBlock, true);
  assert.deepEqual(parsed.managedRange, { start: 1, end: 4 });
});

test('upsertManagedBlock preserves unmanaged content', () => {
  const existing = [
    '# Notes',
    'keep this block',
    '',
    '<!-- rs:managed:start -->',
    'old',
    '<!-- rs:managed:end -->',
    '',
    'tail'
  ].join('\n');

  const next = upsertManagedBlock(existing, 'new-content');
  assert.match(next, /keep this block/);
  assert.match(next, /new-content/);
  assert.match(next, /tail/);
});

test('parseRoadmap emits parseWarnings entry when the same explicit task ID appears twice', () => {
  const content = [
    '## Plan',
    '- [ ] First occurrence <!-- rs:task=shared-id -->',
    '## Archive',
    '- [x] Second occurrence <!-- rs:task=shared-id -->',
    ''
  ].join('\n');

  const parsed = parseRoadmap(content);
  assert.ok(Array.isArray(parsed.parseWarnings));
  assert.equal(parsed.parseWarnings.length, 1);
  assert.deepEqual(parsed.parseWarnings[0], {
    type: 'duplicate-explicit-id',
    id: 'shared-id',
    lineIndex: 3,
    firstLineIndex: 1
  });
});

test('parseRoadmap does not emit parseWarnings when explicit IDs are unique', () => {
  const content = [
    '- [ ] First <!-- rs:task=one -->',
    '- [ ] Second <!-- rs:task=two -->',
    ''
  ].join('\n');

  const parsed = parseRoadmap(content);
  assert.deepEqual(parsed.parseWarnings, []);
});
