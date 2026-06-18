'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MARKETPLACE_JSON_PATH = path.join(REPO_ROOT, '.agents', 'plugins', 'marketplace.json');
const ROOT_CODEX_PLUGIN_JSON_PATH = path.join(REPO_ROOT, '.codex-plugin', 'plugin.json');
const ROOT_SKILLS_PATH = path.join(REPO_ROOT, 'skills');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listSkillDirectories(rootPath) {
  return fs.readdirSync(rootPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

test('repo-local Codex marketplace points at a valid local RoadmapSmith plugin root', () => {
  const marketplace = readJson(MARKETPLACE_JSON_PATH);
  const roadmapsmithEntry = marketplace.plugins.find((plugin) => plugin.name === 'roadmapsmith');

  assert.equal(marketplace.interface.displayName, 'RoadmapSmith Local Plugins');
  assert.ok(roadmapsmithEntry, 'expected a roadmapsmith plugin entry in the local marketplace');
  assert.equal(roadmapsmithEntry.source.source, 'local');
  assert.equal(roadmapsmithEntry.source.path, './plugins/roadmapsmith');
  assert.equal(roadmapsmithEntry.policy.installation, 'AVAILABLE');
  assert.equal(roadmapsmithEntry.policy.authentication, 'ON_INSTALL');

  const pluginRoot = path.resolve(REPO_ROOT, roadmapsmithEntry.source.path);
  const relativeToRepoRoot = path.relative(REPO_ROOT, pluginRoot);
  const marketplacePluginManifest = readJson(path.join(pluginRoot, '.codex-plugin', 'plugin.json'));
  const rootCodexPluginManifest = readJson(ROOT_CODEX_PLUGIN_JSON_PATH);
  const rootSkillDirs = listSkillDirectories(ROOT_SKILLS_PATH);
  const mirroredSkillDirs = listSkillDirectories(path.join(pluginRoot, 'skills'));

  assert.equal(relativeToRepoRoot, path.join('plugins', 'roadmapsmith'), 'marketplace entry should point to the local Codex plugin mirror');
  assert.equal(fs.existsSync(path.join(pluginRoot, '.codex-plugin', 'plugin.json')), true);
  assert.equal(fs.existsSync(path.join(pluginRoot, 'skills')), true);
  assert.deepEqual(marketplacePluginManifest, rootCodexPluginManifest);
  assert.deepEqual(mirroredSkillDirs, rootSkillDirs, 'marketplace mirror skills must match the root skills bundle exactly');
  assert.equal(fs.existsSync(path.join(pluginRoot, 'skills', 'roadmap', 'SKILL.md')), true);
  assert.equal(fs.existsSync(path.join(pluginRoot, 'skills', 'roadmap-update', 'SKILL.md')), true);
  assert.equal(fs.existsSync(path.join(pluginRoot, 'skills', 'roadmap-regenerate', 'SKILL.md')), false);
  assert.equal(fs.existsSync(path.join(pluginRoot, 'assets', 'palette.png')), true);
  assert.equal(fs.existsSync(path.join(pluginRoot, 'assets', 'roadmapsmith-logo.png')), true);
});
