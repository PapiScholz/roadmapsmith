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
