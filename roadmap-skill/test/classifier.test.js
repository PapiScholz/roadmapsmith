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
