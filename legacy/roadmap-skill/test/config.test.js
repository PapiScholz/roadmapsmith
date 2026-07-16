'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const { DEFAULT_CONFIG, loadConfig, resolveRoadmapFile, resolveConfigPath } = require('../src/config');

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

test('resolveConfigPath walks up directories to find roadmap-skill.config.json', () => {
  // v0.13.6: running `roadmapsmith update --check-drift` from a nested subdir
  // should still find the repo-root config instead of silently defaulting.
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-config-walkup-'));
  const configPath = path.join(repoRoot, 'roadmap-skill.config.json');
  fs.writeFileSync(configPath, JSON.stringify({ product: { northStar: 'test' } }));
  const nested = path.join(repoRoot, 'packages', 'foo', 'src');
  fs.mkdirSync(nested, { recursive: true });

  assert.equal(resolveConfigPath({ projectRoot: nested }), configPath);
  const loaded = loadConfig({ projectRoot: nested });
  assert.equal(loaded.product.northStar, 'test');
});

test('resolveConfigPath falls back to projectRoot/roadmap-skill.config.json when no config exists anywhere', () => {
  const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-config-none-'));
  const resolved = resolveConfigPath({ projectRoot: isolated });
  assert.equal(resolved, path.join(isolated, 'roadmap-skill.config.json'));
  assert.equal(fs.existsSync(resolved), false);
});
