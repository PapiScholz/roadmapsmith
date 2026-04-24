'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { generateRoadmapDocument } = require('../src/generator');
const { loadConfig } = require('../src/config');

function setupFixture(name) {
  const source = path.resolve(__dirname, 'fixtures', name);
  const target = fs.mkdtempSync(path.join(os.tmpdir(), `roadmap-skill-${name}-`));
  fs.cpSync(source, target, { recursive: true });
  return target;
}

test('generator outputs deterministic managed roadmap', () => {
  const projectRoot = setupFixture('node');
  const config = loadConfig({ projectRoot });

  const first = generateRoadmapDocument({
    projectRoot,
    roadmapPath: path.join(projectRoot, 'ROADMAP.md'),
    existingContent: '',
    config,
    plugins: []
  });

  const second = generateRoadmapDocument({
    projectRoot,
    roadmapPath: path.join(projectRoot, 'ROADMAP.md'),
    existingContent: first,
    config,
    plugins: []
  });

  assert.equal(first, second);
  assert.match(first, /## Product North Star/);
  assert.match(first, /## Phased Roadmap/);
  assert.match(first, /<!-- rs:task=/);
});
