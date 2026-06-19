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

test('parseRoadmap extracts rs:no-test marker flag', () => {
  const content = '- [ ] Implement windows autostart <!-- rs:task=p0-windows-autostart rs:no-test -->';
  const parsed = parseRoadmap(content);
  assert.equal(parsed.tasks.length, 1);
  assert.equal(parsed.tasks[0].id, 'p0-windows-autostart');
  assert.equal(parsed.tasks[0].noTest, true);
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
