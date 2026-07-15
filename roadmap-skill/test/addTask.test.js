'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { addTask } = require('../src/addTask');

const MANAGED_START = '<!-- rs:managed:start -->';
const MANAGED_END = '<!-- rs:managed:end -->';

test('inserts task into empty content — creates managed block', () => {
  const { content, id } = addTask('Write tests', '');
  assert.ok(content.includes(MANAGED_START));
  assert.ok(content.includes(MANAGED_END));
  assert.ok(content.includes('- [ ] Write tests'));
  assert.ok(content.includes('rs:task=write-tests'));
  assert.equal(id, 'write-tests');
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

  const result = addTask('New feature', content, { phase: 'P1' }).content;
  const lines = result.split('\n');
  const phaseIdx = lines.findIndex((l) => l.includes('Phase P1'));
  const newTaskIdx = lines.findIndex((l) => l.includes('New feature'));
  assert.ok(phaseIdx >= 0, 'phase heading must exist');
  assert.ok(newTaskIdx > phaseIdx, 'new task must appear after phase heading');
});

test('inserts under titled phase header instead of creating a duplicate', () => {
  const content = [
    MANAGED_START,
    '# RoadmapSmith Additions',
    '',
    '### Phase P0 — Migration to X',
    '- [x] existing task <!-- rs:task=existing-p0 -->',
    '',
    '### Phase P1 — Later work',
    '- [ ] p1 task <!-- rs:task=existing-p1 -->',
    MANAGED_END
  ].join('\n');

  const result = addTask('[P0] some new task', content).content;
  const p0HeaderCount = (result.match(/^### Phase P0\b/gm) || []).length;
  assert.equal(p0HeaderCount, 1, 'must not create a duplicate P0 header');

  const lines = result.split('\n');
  const titledIdx = lines.findIndex((l) => l.startsWith('### Phase P0 — Migration to X'));
  const newTaskIdx = lines.findIndex((l) => l.includes('some new task'));
  const nextPhaseIdx = lines.findIndex((l, i) => i > titledIdx && /^### Phase /.test(l));

  assert.ok(titledIdx >= 0, 'titled P0 header must be preserved');
  assert.ok(newTaskIdx > titledIdx, 'new task must appear after the titled header');
  assert.ok(newTaskIdx < nextPhaseIdx, 'new task must appear before the next phase header');
});

test('explicit [P0] in text overrides default phase', () => {
  const { content: result, phase } = addTask('[P0] Set up linting', '');
  assert.ok(result.includes('Phase P0'));
  assert.ok(!result.includes('[P0]'), 'phase label must be stripped');
  assert.ok(result.includes('Set up linting'));
  assert.equal(phase, 'P0');
});

test('phase label is stripped from displayed task text', () => {
  const { content: result, text } = addTask('[P2] Write docs', '');
  const lines = result.split('\n');
  const taskLine = lines.find((l) => l.includes('- [ ]'));
  assert.ok(taskLine, 'must have a task line');
  assert.ok(!taskLine.includes('[P2]'), 'task line must not contain phase label');
  assert.ok(taskLine.includes('Write docs'));
  assert.equal(text, 'Write docs', 'returned text must be the cleaned label-stripped text');
});

test('ID collision avoidance — second identical text gets -2 suffix', () => {
  const first = addTask('Add auth', '');
  const second = addTask('Add auth', first.content);
  assert.equal(first.id, 'add-auth');
  assert.equal(second.id, 'add-auth-2');
  assert.ok(second.content.includes('rs:task=add-auth'), 'first task id must exist');
  assert.ok(second.content.includes('rs:task=add-auth-2'), 'second task must get -2 suffix');
});

test('rendered task line contains rs:planned marker', () => {
  const { content: result } = addTask('Deploy to production', '');
  assert.ok(result.includes('rs:planned'));
});

test('content before managed block is preserved', () => {
  const before = 'My custom notes\n\n' + MANAGED_START + '\n' + MANAGED_END;
  const { content: result } = addTask('New task', before);
  assert.ok(result.startsWith('My custom notes'), 'custom content must be preserved');
  assert.ok(result.includes('New task'));
});
