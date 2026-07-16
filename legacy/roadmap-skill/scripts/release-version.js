'use strict';

const fs = require('fs');
const path = require('path');
const { syncBundleMetadata } = require('./plugin-bundle');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..');
const RELEASE_COMMIT_PATTERN = /^chore\(release\): v(\d+\.\d+\.\d+)(?: \(#\d+\))?$/;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function buildReleasePaths(repoRoot = REPO_ROOT, packageRoot = PACKAGE_ROOT) {
  return {
    repoRoot,
    packageRoot,
    packageJsonPath: path.join(packageRoot, 'package.json'),
    packageLockPath: path.join(packageRoot, 'package-lock.json'),
    skillsManifestPath: path.join(repoRoot, 'skills.json'),
    claudePluginPath: path.join(repoRoot, '.claude-plugin', 'plugin.json'),
    codexPluginPath: path.join(repoRoot, '.codex-plugin', 'plugin.json'),
    marketplacePluginPath: path.join(repoRoot, 'plugins', 'roadmapsmith', '.codex-plugin', 'plugin.json')
  };
}

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version).trim());
  if (!match) {
    throw new Error(`Unsupported version "${version}". Expected x.y.z.`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

function bumpPatchVersion(version) {
  const parsed = parseVersion(version);
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}

function buildReleaseTag(version) {
  return `v${version}`;
}

function buildReleaseCommitMessage(version) {
  return `chore(release): ${buildReleaseTag(version)}`;
}

function detectReleaseMode(commitMessage) {
  return RELEASE_COMMIT_PATTERN.test(String(commitMessage || '').trim()) ? 'repair' : 'normal';
}

function updatePackageLockVersion(lockfile, nextVersion) {
  const next = { ...lockfile, version: nextVersion };

  if (next.packages && next.packages['']) {
    next.packages = {
      ...next.packages,
      '': {
        ...next.packages[''],
        version: nextVersion
      }
    };
  }

  return next;
}

function alignManifestVersion(manifest, nextVersion) {
  return {
    ...manifest,
    version: nextVersion
  };
}

function alignSkillsManifestVersion(skillsManifest, nextVersion) {
  return {
    ...skillsManifest,
    skills: Array.isArray(skillsManifest.skills)
      ? skillsManifest.skills.map((skill) => ({
          ...skill,
          version: nextVersion
        }))
      : []
  };
}

function syncVersionSurfaces(options = {}) {
  const {
    repoRoot = REPO_ROOT,
    packageRoot = PACKAGE_ROOT,
    version,
    write = false
  } = options;

  if (!version) {
    throw new Error('syncVersionSurfaces requires a target version.');
  }

  const paths = buildReleasePaths(repoRoot, packageRoot);
  const skillsManifest = readJson(paths.skillsManifestPath);
  const claudePlugin = readJson(paths.claudePluginPath);
  const codexPlugin = readJson(paths.codexPluginPath);
  const marketplacePlugin = readJson(paths.marketplacePluginPath);

  const nextSkillsManifest = alignSkillsManifestVersion(skillsManifest, version);
  const nextClaudePlugin = alignManifestVersion(claudePlugin, version);
  const nextCodexPlugin = alignManifestVersion(codexPlugin, version);
  const nextMarketplacePlugin = alignManifestVersion(marketplacePlugin, version);

  const changes = [
    { path: paths.skillsManifestPath, before: skillsManifest, after: nextSkillsManifest },
    { path: paths.claudePluginPath, before: claudePlugin, after: nextClaudePlugin },
    { path: paths.codexPluginPath, before: codexPlugin, after: nextCodexPlugin },
    { path: paths.marketplacePluginPath, before: marketplacePlugin, after: nextMarketplacePlugin }
  ].filter((entry) => JSON.stringify(entry.before) !== JSON.stringify(entry.after));

  if (write) {
    changes.forEach((entry) => {
      writeJson(entry.path, entry.after);
    });

    if (repoRoot === REPO_ROOT && packageRoot === PACKAGE_ROOT) {
      syncBundleMetadata({ write: true });
    }
  }

  return {
    version,
    changed: changes.length > 0,
    changedFiles: changes.map((entry) => entry.path)
  };
}

function prepareReleaseVersion(options = {}) {
  const {
    repoRoot = REPO_ROOT,
    packageRoot = PACKAGE_ROOT,
    commitMessage = '',
    write = false
  } = options;

  const paths = buildReleasePaths(repoRoot, packageRoot);
  const packageJson = readJson(paths.packageJsonPath);
  const packageLock = readJson(paths.packageLockPath);
  const mode = detectReleaseMode(commitMessage);
  const previousVersion = packageJson.version;
  const version = mode === 'repair' ? previousVersion : bumpPatchVersion(previousVersion);
  const changedFiles = [];

  if (write && mode === 'normal') {
    writeJson(paths.packageJsonPath, { ...packageJson, version });
    writeJson(paths.packageLockPath, updatePackageLockVersion(packageLock, version));
    changedFiles.push(paths.packageJsonPath, paths.packageLockPath);

    const syncResult = syncVersionSurfaces({ repoRoot, packageRoot, version, write: true });
    changedFiles.push(...syncResult.changedFiles);
  }

  return {
    mode,
    previousVersion,
    version,
    tag: buildReleaseTag(version),
    releaseCommitMessage: buildReleaseCommitMessage(version),
    changed: mode === 'normal' && previousVersion !== version,
    changedFiles
  };
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = argv.slice();
  const options = {
    commitMessage: '',
    json: false,
    write: false
  };

  while (args.length > 0) {
    const arg = args.shift();
    if (arg === '--write') {
      options.write = true;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--commit-message') {
      options.commitMessage = args.shift() || '';
      continue;
    }
    throw new Error(`Unknown argument "${arg}".`);
  }

  return options;
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const result = prepareReleaseVersion(options);

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${result.mode}:${result.previousVersion}->${result.version}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  PACKAGE_ROOT,
  REPO_ROOT,
  RELEASE_COMMIT_PATTERN,
  alignManifestVersion,
  alignSkillsManifestVersion,
  buildReleaseCommitMessage,
  buildReleasePaths,
  buildReleaseTag,
  bumpPatchVersion,
  detectReleaseMode,
  main,
  parseArgs,
  parseVersion,
  prepareReleaseVersion,
  syncVersionSurfaces,
  updatePackageLockVersion
};
