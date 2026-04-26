'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROADMAP_PATH = path.resolve(__dirname, '../../ROADMAP.md');

test('root ROADMAP.md exists and is managed by RoadmapSmith', () => {
  const content = fs.readFileSync(ROADMAP_PATH, 'utf8');
  assert.match(content, /<!-- rs:managed:start -->/, 'Missing rs:managed:start marker');
  assert.match(content, /<!-- rs:managed:end -->/, 'Missing rs:managed:end marker');
});

test('root ROADMAP.md contains all 12 professional section headers', () => {
  const content = fs.readFileSync(ROADMAP_PATH, 'utf8');
  for (let i = 1; i <= 12; i += 1) {
    assert.match(content, new RegExp(`^## ${i}\\.`, 'm'), `Missing section ## ${i}.`);
  }
});

test('root ROADMAP.md contains professional rs:task IDs', () => {
  const content = fs.readFileSync(ROADMAP_PATH, 'utf8');
  assert.match(content, /rs:task=prof-/, 'Expected prof- prefixed rs:task IDs from professional renderer');
});

test('root ROADMAP.md has Phase → Step hierarchy in Section 4', () => {
  const content = fs.readFileSync(ROADMAP_PATH, 'utf8');
  assert.match(content, /### Phase 1:/, 'Missing Phase 1 in Section 4');
  assert.match(content, /### Phase 2:/, 'Missing Phase 2 in Section 4');
  assert.match(content, /#### Step 1\./, 'Missing Step 1.x in Section 4');
  assert.doesNotMatch(content, /### Phase P0/, 'Compact phase headers should not appear in professional output');
});

test('root ROADMAP.md contains task-level priority labels', () => {
  const content = fs.readFileSync(ROADMAP_PATH, 'utf8');
  assert.match(content, /`\[P0\]`/, 'Expected [P0] priority label in ROADMAP.md');
});
