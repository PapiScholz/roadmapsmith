'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { importTasks } = require('../src/importer');

function writeTmp(name, content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'importer-test-'));
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

test('parses tasks from a markdown file', () => {
  const filePath = writeTmp('ROADMAP.md', [
    '# Project',
    '',
    '- [ ] Set up CI <!-- rs:task=setup-ci -->',
    '- [x] Write README <!-- rs:task=write-readme -->',
  ].join('\n'));

  const tasks = importTasks(filePath);
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].id, 'setup-ci');
  assert.equal(tasks[0].checked, false);
  assert.equal(tasks[1].id, 'write-readme');
  assert.equal(tasks[1].checked, true);
});

test('returns empty array for missing file', () => {
  const tasks = importTasks('/nonexistent/path/ROADMAP.md');
  assert.deepEqual(tasks, []);
});

test('accepts string array', () => {
  const filePath = writeTmp('TODO.md', '- [ ] Add tests <!-- rs:task=add-tests -->\n');
  const tasks = importTasks([filePath]);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].id, 'add-tests');
});

test('deduplicates by id across files — first-seen wins', () => {
  const file1 = writeTmp('ROADMAP.md', '- [ ] Deploy app <!-- rs:task=deploy-app -->\n');
  const file2 = writeTmp('NOTES.md', '- [x] Deploy app <!-- rs:task=deploy-app -->\n');
  const tasks = importTasks([file1, file2]);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].checked, false);
});

test('skips unreadable files and returns tasks from readable ones', () => {
  const filePath = writeTmp('ROADMAP.md', '- [ ] Valid task <!-- rs:task=valid-task -->\n');
  const tasks = importTasks(['/nonexistent/path.md', filePath]);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].id, 'valid-task');
});
