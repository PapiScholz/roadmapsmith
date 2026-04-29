'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyProject } = require('../src/classifier');
const { walkFiles } = require('../src/io');

function setupFixture(name) {
  const source = path.resolve(__dirname, 'fixtures', name);
  const target = fs.mkdtempSync(path.join(os.tmpdir(), `roadmap-skill-${name}-`));
  fs.cpSync(source, target, { recursive: true });
  return target;
}

test('classifier identifies landing-site fixture', () => {
  const projectRoot = setupFixture('landing-site');
  const files = walkFiles(projectRoot);
  const result = classifyProject({ projectRoot, files });
  assert.equal(result.type, 'landing-site');
  assert.ok(['high', 'medium'].includes(result.confidence), `confidence="${result.confidence}"`);
  assert.ok(result.signals.length > 0, 'should report at least one signal');
});

test('classifier identifies node fixture as non-web archetype', () => {
  const projectRoot = setupFixture('node');
  const files = walkFiles(projectRoot);
  const result = classifyProject({ projectRoot, files });
  assert.notEqual(result.type, 'landing-site');
  assert.notEqual(result.type, 'frontend-web');
});

test('classifier identifies monorepo fixture as monorepo', () => {
  const projectRoot = setupFixture('monorepo');
  const files = walkFiles(projectRoot);
  const result = classifyProject({ projectRoot, files });
  assert.equal(result.type, 'monorepo');
});

test('classifier returns unknown-generic for empty project', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-empty-'));
  const result = classifyProject({ projectRoot, files: [] });
  assert.equal(result.type, 'unknown-generic');
  assert.equal(result.confidence, 'low');
});

test('classifier result always has required shape', () => {
  const result = classifyProject({ projectRoot: '', files: [] });
  assert.ok('type' in result, 'must have type');
  assert.ok('confidence' in result, 'must have confidence');
  assert.ok(Array.isArray(result.signals), 'signals must be array');
});

const { scanProject } = require('../src/generator');

test('scanProject includes projectType for landing-site fixture', () => {
  const projectRoot = setupFixture('landing-site');
  const result = scanProject(projectRoot);
  assert.equal(result.projectType, 'landing-site');
  assert.ok(['high', 'medium'].includes(result.classifierConfidence), `confidence="${result.classifierConfidence}"`);
  assert.ok(Array.isArray(result.classifierSignals));
  assert.ok(result.classifierSignals.length > 0);
});

test('scanProject includes projectType for node fixture (non-web)', () => {
  const projectRoot = setupFixture('node');
  const result = scanProject(projectRoot);
  assert.ok(typeof result.projectType === 'string', 'projectType must be a string');
  assert.notEqual(result.projectType, 'landing-site');
  assert.notEqual(result.projectType, 'frontend-web');
  assert.ok(typeof result.classifierConfidence === 'string');
  assert.ok(Array.isArray(result.classifierSignals));
});

const { generateRoadmapDocument } = require('../src/generator');
const { loadConfig } = require('../src/config');

test('compact: landing-site fixture includes Detected Project Profile section', () => {
  const projectRoot = setupFixture('landing-site');
  const config = loadConfig({ projectRoot });
  const output = generateRoadmapDocument({ projectRoot, existingContent: '', config, plugins: [] });
  assert.match(output, /## Detected Project Profile/);
  assert.match(output, /landing-site/);
  assert.match(output, /\*\*Confidence:\*\*/);
  assert.match(output, /\*\*Evidence:\*\*/);
});

test('professional: landing-site fixture includes Detected Project Profile section', () => {
  const projectRoot = setupFixture('landing-site');
  const config = Object.assign({}, loadConfig({ projectRoot }), { roadmapProfile: 'professional' });
  const output = generateRoadmapDocument({ projectRoot, existingContent: '', config, plugins: [] });
  assert.match(output, /## Detected Project Profile/);
  assert.match(output, /landing-site/);
});

test('compact: node fixture includes Detected Project Profile section', () => {
  const projectRoot = setupFixture('node');
  const config = loadConfig({ projectRoot });
  const output = generateRoadmapDocument({ projectRoot, existingContent: '', config, plugins: [] });
  assert.match(output, /## Detected Project Profile/);
  assert.match(output, /\*\*Type:\*\*/);
});
