'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const { DEFAULT_CONFIG, loadConfig, resolveRoadmapFile } = require('../src/config');

function withMockedReaddir(entries, callback) {
  const original = fs.readdirSync;
  fs.readdirSync = () => entries;
  try {
    return callback();
  } finally {
    fs.readdirSync = original;
  }
}

function defaultConfig() {
  return {
    roadmapFile: DEFAULT_CONFIG.roadmapFile
  };
}

test('resolveRoadmapFile prefers canonical ROADMAP.md when canonical and legacy entries are present', () => {
  const projectRoot = path.resolve(process.cwd(), 'tmp-project');
  const resolved = withMockedReaddir(['ROADMAP.md', 'roadmap.md'], () => {
    return resolveRoadmapFile(projectRoot, defaultConfig());
  });

  assert.equal(resolved, path.resolve(projectRoot, './ROADMAP.md'));
});

test('resolveRoadmapFile falls back to legacy roadmap.md when canonical entry is absent', () => {
  const projectRoot = path.resolve(process.cwd(), 'tmp-project');
  const resolved = withMockedReaddir(['roadmap.md'], () => {
    return resolveRoadmapFile(projectRoot, defaultConfig());
  });

  assert.equal(resolved, path.resolve(projectRoot, './roadmap.md'));
});

test('resolveRoadmapFile defaults to canonical ROADMAP.md when neither entry exists', () => {
  const projectRoot = path.resolve(process.cwd(), 'tmp-project');
  const resolved = withMockedReaddir([], () => {
    return resolveRoadmapFile(projectRoot, defaultConfig());
  });

  assert.equal(resolved, path.resolve(projectRoot, './ROADMAP.md'));
});

test('DEFAULT_CONFIG.pathAliases is an empty object', () => {
  assert.deepEqual(DEFAULT_CONFIG.pathAliases, {});
});

test('loadConfig preserves user-defined pathAliases object', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-skill-config-'));
  const aliases = {
    '/dashboard/': 'apps/web/src/app/dashboard/',
    'dashboard/': 'apps/web/src/app/dashboard/'
  };
  fs.writeFileSync(path.join(dir, 'roadmap-skill.config.json'), JSON.stringify({ pathAliases: aliases }));
  const loaded = loadConfig({ projectRoot: dir });
  assert.deepEqual(loaded.pathAliases, aliases);
});
