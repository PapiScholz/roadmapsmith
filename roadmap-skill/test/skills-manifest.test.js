'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SKILLS_JSON_PATH = path.join(REPO_ROOT, 'skills.json');
const EXPECTED_SKILL_NAMES = [
  'road',
  'zero',
  'maintain',
  'status',
  'init',
  'generate',
  'validate',
  'sync',
  'audit',
  'setup',
  'roadmap-sync'
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('skills.json lists the complete Claude GUI skill bundle', () => {
  const manifest = readJson(SKILLS_JSON_PATH);
  const names = manifest.skills.map((skill) => skill.name);

  assert.deepEqual(names, EXPECTED_SKILL_NAMES);
  assert.match(manifest.install.command, /--skill '\*' -a claude-code/);
  assert.match(manifest.install.notes, /\/road/);
  assert.match(manifest.install.notes, /\/roadmap-sync/);
});

test('every skill listed in skills.json exists and exposes the expected name', () => {
  const manifest = readJson(SKILLS_JSON_PATH);

  manifest.skills.forEach((skill) => {
    const skillFile = path.join(REPO_ROOT, skill.path, 'SKILL.md');
    const content = fs.readFileSync(skillFile, 'utf8');

    assert.equal(fs.existsSync(skillFile), true, `missing ${skillFile}`);
    assert.match(content, new RegExp(`name:\\s+${skill.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    assert.match(content, /description:/);
  });
});
