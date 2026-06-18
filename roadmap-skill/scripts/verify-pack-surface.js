'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  PACKAGE_ROOT,
  ROOT_CODEX_PLUGIN_JSON_PATH,
  getCodexPluginAssetPaths,
  ROOT_SKILLS_JSON_PATH,
  readJson
} = require('./plugin-bundle');

function resolveNpmInvocation() {
  if (process.env.npm_execpath) {
    return {
      command: process.execPath,
      prefixArgs: [process.env.npm_execpath]
    };
  }

  if (process.platform === 'win32') {
    const comspec = process.env.ComSpec || path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'cmd.exe');
    return {
      command: comspec,
      prefixArgs: ['/d', '/s', '/c', 'npm.cmd']
    };
  }

  return {
    command: 'npm',
    prefixArgs: []
  };
}

function parsePackJson(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    throw new Error('npm pack --json returned empty output.');
  }

  try {
    return JSON.parse(trimmed);
  } catch (_) {
    const firstBracket = trimmed.indexOf('[');
    const lastBracket = trimmed.lastIndexOf(']');
    if (firstBracket >= 0 && lastBracket > firstBracket) {
      return JSON.parse(trimmed.slice(firstBracket, lastBracket + 1));
    }
    throw new Error(`Unable to parse npm pack JSON output:\n${trimmed}`);
  }
}

function runNpmPackJson(packDestination) {
  const npmInvocation = resolveNpmInvocation();
  const raw = execFileSync(
    npmInvocation.command,
    [...npmInvocation.prefixArgs, 'pack', '--json', '--pack-destination', packDestination],
    {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8'
    }
  );

  return parsePackJson(raw);
}

function assertPackSurface(files) {
  const manifest = readJson(ROOT_SKILLS_JSON_PATH);
  const codexPluginManifest = readJson(ROOT_CODEX_PLUGIN_JSON_PATH);
  const fileSet = new Set(files.map((entry) => entry.path));
  const packagedSkillNames = files
    .map((entry) => {
      const match = String(entry.path || '').match(/^skills\/([^/]+)\/SKILL\.md$/);
      return match ? match[1] : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
  const manifestSkillNames = manifest.skills
    .map((skill) => String(skill.path || '').replace(/^skills\//, ''))
    .sort((left, right) => left.localeCompare(right));
  const requiredPaths = [
    'skills.json',
    '.claude-plugin/plugin.json',
    '.codex-plugin/plugin.json',
    ...getCodexPluginAssetPaths(codexPluginManifest),
    ...manifest.skills.map((skill) => `${skill.path}/SKILL.md`)
  ];

  requiredPaths.forEach((requiredPath) => {
    if (!fileSet.has(requiredPath)) {
      throw new Error(`Packed npm artifact is missing required plugin bundle file: ${requiredPath}`);
    }
  });

  if (JSON.stringify(packagedSkillNames) !== JSON.stringify(manifestSkillNames)) {
    throw new Error(
      `Packed npm artifact skill surface drifted from skills.json. Expected ${manifestSkillNames.join(', ')} but found ${packagedSkillNames.join(', ')}.`
    );
  }
}

function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmapsmith-pack-'));

  try {
    const results = runNpmPackJson(tempDir);
    const packResult = Array.isArray(results) ? results[0] : results;

    if (!packResult || !Array.isArray(packResult.files)) {
      throw new Error('npm pack --json did not return a file listing.');
    }

    assertPackSurface(packResult.files);
    process.stdout.write(`Verified packed npm artifact surface via ${packResult.filename}.\n`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  assertPackSurface,
  parsePackJson,
  resolveNpmInvocation,
  runNpmPackJson
};
