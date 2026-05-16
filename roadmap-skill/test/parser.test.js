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

test('parseRoadmap extracts rs:no-test marker flag', () => {
  const content = '- [ ] Implement windows autostart <!-- rs:task=p0-windows-autostart rs:no-test -->';
  const parsed = parseRoadmap(content);
  assert.equal(parsed.tasks.length, 1);
  assert.equal(parsed.tasks[0].id, 'p0-windows-autostart');
  assert.equal(parsed.tasks[0].noTest, true);
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
