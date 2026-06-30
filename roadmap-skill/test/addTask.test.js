'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { addTask } = require('../src/addTask');

const MANAGED_START = '<!-- rs:managed:start -->';
const MANAGED_END = '<!-- rs:managed:end -->';

test('inserts task into empty content — creates managed block', () => {
  const result = addTask('Write tests', '');
  assert.ok(result.includes(MANAGED_START));
  assert.ok(result.includes(MANAGED_END));
  assert.ok(result.includes('- [ ] Write tests'));
  assert.ok(result.includes('rs:task=write-tests'));
});

test('inserts task under correct phase in existing managed block', () => {
  const content = [
    MANAGED_START,
    '# RoadmapSmith Additions',
    '',
    '### Phase P1',
    '- [ ] Existing task <!-- rs:task=existing-task -->',
    MANAGED_END
  ].join('\n');

  const result = addTask('New feature', content, { phase: 'P1' });
  const lines = result.split('\n');
  const phaseIdx = lines.findIndex((l) => l.includes('Phase P1'));
  const newTaskIdx = lines.findIndex((l) => l.includes('New feature'));
  assert.ok(phaseIdx >= 0, 'phase heading must exist');
  assert.ok(newTaskIdx > phaseIdx, 'new task must appear after phase heading');
});

test('explicit [P0] in text overrides default phase', () => {
  const result = addTask('[P0] Set up linting', '');
  assert.ok(result.includes('Phase P0'));
  assert.ok(!result.includes('[P0]'), 'phase label must be stripped');
  assert.ok(result.includes('Set up linting'));
});

test('phase label is stripped from displayed task text', () => {
  const result = addTask('[P2] Write docs', '');
  const lines = result.split('\n');
  const taskLine = lines.find((l) => l.includes('- [ ]'));
  assert.ok(taskLine, 'must have a task line');
  assert.ok(!taskLine.includes('[P2]'), 'task line must not contain phase label');
  assert.ok(taskLine.includes('Write docs'));
});

test('ID collision avoidance — second identical text gets -2 suffix', () => {
  const content1 = addTask('Add auth', '');
  const content2 = addTask('Add auth', content1);
  assert.ok(content2.includes('rs:task=add-auth'), 'first task id must exist');
  assert.ok(content2.includes('rs:task=add-auth-2'), 'second task must get -2 suffix');
});

test('rendered task line contains rs:planned marker', () => {
  const result = addTask('Deploy to production', '');
  assert.ok(result.includes('rs:planned'));
});

test('content before managed block is preserved', () => {
  const before = 'My custom notes\n\n' + MANAGED_START + '\n' + MANAGED_END;
  const result = addTask('New task', before);
  assert.ok(result.startsWith('My custom notes'), 'custom content must be preserved');
  assert.ok(result.includes('New task'));
});
