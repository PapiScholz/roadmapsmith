'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyProject } = require('../src/classifier');
const { detectLanguages, walkFiles } = require('../src/io');

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

test('classifier identifies Electron fixtures as electron-app instead of web', () => {
  const projectRoot = setupFixture('electron-pos');
  const files = walkFiles(projectRoot);
  const result = classifyProject({ projectRoot, files });

  assert.equal(result.type, 'electron-app');
  assert.notEqual(result.type, 'frontend-web');
  assert.notEqual(result.type, 'landing-site');
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

test('generator with landing-site fixture includes web-specific tasks', () => {
  const projectRoot = setupFixture('landing-site');
  const config = loadConfig({ projectRoot });
  const output = generateRoadmapDocument({ projectRoot, existingContent: '', config, plugins: [] });
  const webTerms = ['SEO', 'metadata', 'OpenGraph', 'responsive', 'mobile', 'performance',
    'contact', 'deployment', 'hosting', 'branding', 'services'];
  const found = webTerms.filter((term) => output.toLowerCase().includes(term.toLowerCase()));
  assert.ok(found.length >= 5, `Expected ≥5 web terms, found ${found.length}: [${found.join(', ')}]`);
});

test('generator with node fixture does NOT emit web-specific tasks', () => {
  const projectRoot = setupFixture('node');
  const config = loadConfig({ projectRoot });
  const output = generateRoadmapDocument({ projectRoot, existingContent: '', config, plugins: [] });
  assert.doesNotMatch(output, /OpenGraph/i, 'node fixture should not have OpenGraph task');
  assert.doesNotMatch(output, /Lighthouse/i, 'node fixture should not have Lighthouse task');
});

test('detectLanguages ignores stray Python helper noise when TypeScript app files dominate', () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-lang-weighting-'));
  fs.mkdirSync(path.join(projectRoot, 'electron'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'electron', 'main.ts'), 'export const main = true;\n');
  fs.writeFileSync(path.join(projectRoot, 'src', 'renderer.tsx'), 'export const renderer = true;\n');
  fs.writeFileSync(path.join(projectRoot, 'src', 'db.ts'), 'export const db = true;\n');
  fs.writeFileSync(path.join(projectRoot, 'scripts', 'healthcheck.py'), 'print("helper only")\n');

  const files = walkFiles(projectRoot);
  const languages = detectLanguages(files);

  assert.equal(languages.includes('TypeScript'), true);
  assert.equal(languages.includes('Python'), false);
});

test('generated web/landing tasks are all unchecked in generateRoadmapDocument output', () => {
  const projectRoot = setupFixture('landing-site');
  const config = loadConfig({ projectRoot });
  const output = generateRoadmapDocument({ projectRoot, existingContent: '', config, plugins: [] });
  const taskLines = output.split('\n').filter((line) => /^- \[[x ]\]/.test(line));
  const checkedTasks = taskLines.filter((line) => /^- \[x\]/.test(line));
  assert.equal(checkedTasks.length, 0,
    `Expected 0 checked tasks on fresh generate, found ${checkedTasks.length}:\n${checkedTasks.join('\n')}`
  );
});
