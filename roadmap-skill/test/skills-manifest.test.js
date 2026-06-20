'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(PACKAGE_ROOT, 'package.json');
const SKILLS_JSON_PATH = path.join(REPO_ROOT, 'skills.json');
const CLAUDE_PLUGIN_JSON_PATH = path.join(REPO_ROOT, '.claude-plugin', 'plugin.json');
const CODEX_PLUGIN_JSON_PATH = path.join(REPO_ROOT, '.codex-plugin', 'plugin.json');
const ROADMAP_SYNC_OPENAI_YAML_PATH = path.join(REPO_ROOT, 'skills', 'roadmap-sync', 'agents', 'openai.yaml');
const RELEASE_READINESS_DOC_PATH = path.join(REPO_ROOT, 'docs', 'release-readiness.md');
const RELEASE_UX_GATE_DOC_PATH = path.join(REPO_ROOT, 'docs', 'release-ux-gate.md');
const EXPECTED_SKILL_NAMES = [
  'roadmap',
  'roadmap-zero',
  'roadmap-maintain',
  'roadmap-status',
  'roadmap-init',
  'roadmap-generate',
  'roadmap-validate',
  'roadmap-update',
  'roadmap-sync',
  'roadmap-audit',
  'roadmap-setup'
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeRepository(repository) {
  const raw = typeof repository === 'string' ? repository : repository && repository.url;
  return raw ? raw.replace(/^git\+/, '').replace(/\.git$/, '') : undefined;
}

function normalizeAuthor(author) {
  return typeof author === 'string' ? { name: author } : author;
}

test('skills.json lists the complete Claude GUI skill bundle', () => {
  const manifest = readJson(SKILLS_JSON_PATH);
  const names = manifest.skills.map((skill) => skill.name);

  assert.deepEqual(names, EXPECTED_SKILL_NAMES);
  assert.match(manifest.install.command, /--skill '\*' -a claude-code/);
  assert.match(manifest.install.notes, /\/roadmap/);
  assert.match(manifest.install.notes, /\/roadmap-sync/);
});

test('bundle metadata versions stay aligned with roadmap-skill package.json', () => {
  const packageJson = readJson(PACKAGE_JSON_PATH);
  const skillsManifest = readJson(SKILLS_JSON_PATH);
  const claudePluginManifest = readJson(CLAUDE_PLUGIN_JSON_PATH);
  const codexPluginManifest = readJson(CODEX_PLUGIN_JSON_PATH);

  assert.equal(claudePluginManifest.version, packageJson.version);
  assert.equal(codexPluginManifest.version, packageJson.version);
  skillsManifest.skills.forEach((skill) => {
    assert.equal(skill.version, packageJson.version, `skill ${skill.name} version drifted from package.json`);
  });
});

test('Codex and Claude plugin manifests stay aligned with shared package metadata', () => {
  const packageJson = readJson(PACKAGE_JSON_PATH);
  const claudePluginManifest = readJson(CLAUDE_PLUGIN_JSON_PATH);
  const codexPluginManifest = readJson(CODEX_PLUGIN_JSON_PATH);
  const expectedAuthor = normalizeAuthor(packageJson.author);
  const expectedRepository = normalizeRepository(packageJson.repository);

  [claudePluginManifest, codexPluginManifest].forEach((pluginManifest) => {
    assert.equal(pluginManifest.name, packageJson.name);
    assert.equal(pluginManifest.version, packageJson.version);
    assert.equal(pluginManifest.description, packageJson.description);
    assert.deepEqual(pluginManifest.author, expectedAuthor);
    assert.equal(pluginManifest.homepage, packageJson.homepage);
    assert.equal(pluginManifest.repository, expectedRepository);
    assert.equal(pluginManifest.license, packageJson.license);
    assert.deepEqual(pluginManifest.keywords, packageJson.keywords);
  });

  assert.equal(codexPluginManifest.skills, './skills/');
  assert.equal(codexPluginManifest.interface.displayName, 'RoadmapSmith');
  assert.equal(codexPluginManifest.interface.developerName, expectedAuthor.name);
  assert.equal(codexPluginManifest.interface.websiteURL, packageJson.homepage);
  assert.match(codexPluginManifest.interface.composerIcon, /^\.\/assets\//);
  assert.match(codexPluginManifest.interface.logo, /^\.\/assets\//);
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

test('root skills directory contains only the declared namespaced RoadmapSmith bundle', () => {
  const skillDirs = fs.readdirSync(path.join(REPO_ROOT, 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  assert.deepEqual(skillDirs, EXPECTED_SKILL_NAMES.slice().sort((left, right) => left.localeCompare(right)));
});

test('roadmap-sync Codex metadata parses cleanly and stays short enough for the loader', () => {
  const metadata = JSON.parse(fs.readFileSync(ROADMAP_SYNC_OPENAI_YAML_PATH, 'utf8'));

  assert.equal(metadata.interface.display_name, 'Roadmap Sync (Deprecated)');
  assert.match(metadata.interface.short_description, /deprecated/i);
  assert.match(metadata.interface.default_prompt, /\/roadmap-update/);
  assert.ok(metadata.interface.default_prompt.length <= 128);
});

test('release runbooks do not document codex marketplace add from roadmap-skill cwd', () => {
  [RELEASE_READINESS_DOC_PATH, RELEASE_UX_GATE_DOC_PATH].forEach((filePath) => {
    const content = fs.readFileSync(filePath, 'utf8');
    assert.doesNotMatch(
      content,
      /```(?:bash|powershell)[\s\S]*?cd roadmap-skill[\s\S]*?codex plugin marketplace add \.(?!\.)[\s\S]*?```/,
      `wrong Codex marketplace cwd documented in ${path.basename(filePath)}`
    );
  });
});
