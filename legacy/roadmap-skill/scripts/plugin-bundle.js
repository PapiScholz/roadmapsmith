'use strict';

const fs = require('fs');
const path = require('path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..');
const ROOT_SKILLS_PATH = path.join(REPO_ROOT, 'skills');
const ROOT_SKILLS_JSON_PATH = path.join(REPO_ROOT, 'skills.json');
const ROOT_CLAUDE_PLUGIN_DIR_PATH = path.join(REPO_ROOT, '.claude-plugin');
const ROOT_CLAUDE_PLUGIN_JSON_PATH = path.join(ROOT_CLAUDE_PLUGIN_DIR_PATH, 'plugin.json');
const ROOT_CODEX_PLUGIN_DIR_PATH = path.join(REPO_ROOT, '.codex-plugin');
const ROOT_CODEX_PLUGIN_JSON_PATH = path.join(ROOT_CODEX_PLUGIN_DIR_PATH, 'plugin.json');
const ROOT_MARKETPLACE_PLUGIN_ROOT = path.join(REPO_ROOT, 'plugins', 'roadmapsmith');
const ROOT_MARKETPLACE_PLUGIN_JSON_PATH = path.join(ROOT_MARKETPLACE_PLUGIN_ROOT, '.codex-plugin', 'plugin.json');
const STAGED_SKILLS_PATH = path.join(PACKAGE_ROOT, 'skills');
const STAGED_SKILLS_JSON_PATH = path.join(PACKAGE_ROOT, 'skills.json');
const STAGED_CLAUDE_PLUGIN_DIR_PATH = path.join(PACKAGE_ROOT, '.claude-plugin');
const STAGED_CLAUDE_PLUGIN_JSON_PATH = path.join(STAGED_CLAUDE_PLUGIN_DIR_PATH, 'plugin.json');
const STAGED_CODEX_PLUGIN_DIR_PATH = path.join(PACKAGE_ROOT, '.codex-plugin');
const STAGED_CODEX_PLUGIN_JSON_PATH = path.join(STAGED_CODEX_PLUGIN_DIR_PATH, 'plugin.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function getPackageJson() {
  return readJson(path.join(PACKAGE_ROOT, 'package.json'));
}

function normalizeRepository(repository) {
  const raw = typeof repository === 'string' ? repository : repository && repository.url;
  if (!raw) {
    return undefined;
  }

  return raw.replace(/^git\+/, '').replace(/\.git$/, '');
}

function normalizeAuthor(author) {
  if (!author) {
    return undefined;
  }

  if (typeof author === 'string') {
    return { name: author };
  }

  const normalized = {};
  if (author.name) {
    normalized.name = author.name;
  }
  if (author.email) {
    normalized.email = author.email;
  }
  if (author.url) {
    normalized.url = author.url;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function buildSharedPluginMetadata(packageJson) {
  return {
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
    author: normalizeAuthor(packageJson.author),
    homepage: packageJson.homepage,
    repository: normalizeRepository(packageJson.repository),
    license: packageJson.license,
    keywords: Array.isArray(packageJson.keywords) ? packageJson.keywords.slice() : []
  };
}

function applySharedPluginMetadata(pluginManifest, packageJson) {
  return {
    ...pluginManifest,
    ...buildSharedPluginMetadata(packageJson)
  };
}

function alignCodexPluginManifest(pluginManifest, packageJson) {
  const sharedAuthor = normalizeAuthor(packageJson.author);

  return {
    ...applySharedPluginMetadata(pluginManifest, packageJson),
    skills: './skills/',
    interface: {
      ...pluginManifest.interface,
      developerName: sharedAuthor && sharedAuthor.name ? sharedAuthor.name : pluginManifest.interface && pluginManifest.interface.developerName,
      websiteURL: packageJson.homepage || (pluginManifest.interface && pluginManifest.interface.websiteURL)
    }
  };
}

function buildAlignedBundle(packageJson = getPackageJson()) {
  const skillsManifest = readJson(ROOT_SKILLS_JSON_PATH);
  const claudePluginManifest = applySharedPluginMetadata(readJson(ROOT_CLAUDE_PLUGIN_JSON_PATH), packageJson);
  const codexPluginManifest = alignCodexPluginManifest(readJson(ROOT_CODEX_PLUGIN_JSON_PATH), packageJson);

  skillsManifest.skills = skillsManifest.skills.map((skill) => ({
    ...skill,
    version: packageJson.version
  }));

  return {
    packageJson,
    skillsManifest,
    claudePluginManifest,
    codexPluginManifest
  };
}

function syncBundleMetadata(options = {}) {
  const packageJson = getPackageJson();
  const { skillsManifest, claudePluginManifest, codexPluginManifest } = buildAlignedBundle(packageJson);
  const shouldWrite = options.write === true;

  const currentSkillsManifest = readJson(ROOT_SKILLS_JSON_PATH);
  const currentClaudePluginManifest = readJson(ROOT_CLAUDE_PLUGIN_JSON_PATH);
  const currentCodexPluginManifest = readJson(ROOT_CODEX_PLUGIN_JSON_PATH);

  const skillsMismatch = JSON.stringify(currentSkillsManifest) !== JSON.stringify(skillsManifest);
  const claudePluginMismatch = JSON.stringify(currentClaudePluginManifest) !== JSON.stringify(claudePluginManifest);
  const codexPluginMismatch = JSON.stringify(currentCodexPluginManifest) !== JSON.stringify(codexPluginManifest);

  if (shouldWrite) {
    if (skillsMismatch) {
      writeJson(ROOT_SKILLS_JSON_PATH, skillsManifest);
    }
    if (claudePluginMismatch) {
      writeJson(ROOT_CLAUDE_PLUGIN_JSON_PATH, claudePluginManifest);
    }
    if (codexPluginMismatch) {
      writeJson(ROOT_CODEX_PLUGIN_JSON_PATH, codexPluginManifest);
    }
    syncMarketplacePluginMirror(codexPluginManifest);
  }

  return {
    version: packageJson.version,
    packageJson,
    skillsManifest,
    claudePluginManifest,
    codexPluginManifest,
    skillsMismatch,
    claudePluginMismatch,
    codexPluginMismatch,
    changed: skillsMismatch || claudePluginMismatch || codexPluginMismatch
  };
}

function ensureBundleIsAligned() {
  const result = syncBundleMetadata({ write: false });

  if (result.changed) {
    const mismatches = [];
    if (result.skillsMismatch) {
      mismatches.push('skills.json');
    }
    if (result.claudePluginMismatch) {
      mismatches.push('.claude-plugin/plugin.json');
    }
    if (result.codexPluginMismatch) {
      mismatches.push('.codex-plugin/plugin.json');
    }
    throw new Error(
      `Plugin bundle metadata is out of sync with roadmap-skill/package.json (${result.version}): ${mismatches.join(', ')}. Run "npm run sync-bundle-metadata" from roadmap-skill.`
    );
  }

  return result;
}

function getCodexPluginAssetPaths(codexPluginManifest = readJson(ROOT_CODEX_PLUGIN_JSON_PATH)) {
  const assetCandidates = [
    codexPluginManifest.interface && codexPluginManifest.interface.composerIcon,
    codexPluginManifest.interface && codexPluginManifest.interface.logo,
    ...((codexPluginManifest.interface && codexPluginManifest.interface.screenshots) || [])
  ];

  return Array.from(
    new Set(
      assetCandidates
        .filter((candidate) => typeof candidate === 'string' && candidate.startsWith('./assets/'))
        .map((candidate) => candidate.replace(/^\.\//, ''))
    )
  );
}

function copyRelativeFile(relativePath) {
  copyRelativeFileToRoot(relativePath, PACKAGE_ROOT);
}

function copyRelativeFileToRoot(relativePath, destinationRoot) {
  const sourcePath = path.join(REPO_ROOT, relativePath);
  const destinationPath = path.join(destinationRoot, relativePath);

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
}

function removeFileAndEmptyParents(filePath, stopDir) {
  fs.rmSync(filePath, { force: true });

  let currentDir = path.dirname(filePath);
  while (currentDir.startsWith(stopDir) && currentDir !== stopDir) {
    if (!fs.existsSync(currentDir) || fs.readdirSync(currentDir).length > 0) {
      break;
    }
    fs.rmdirSync(currentDir);
    currentDir = path.dirname(currentDir);
  }
}

function stagePluginBundle() {
  const { codexPluginManifest } = ensureBundleIsAligned();
  cleanStagedPluginBundle();

  fs.cpSync(ROOT_SKILLS_PATH, STAGED_SKILLS_PATH, { recursive: true });
  fs.copyFileSync(ROOT_SKILLS_JSON_PATH, STAGED_SKILLS_JSON_PATH);
  fs.cpSync(ROOT_CLAUDE_PLUGIN_DIR_PATH, STAGED_CLAUDE_PLUGIN_DIR_PATH, { recursive: true });
  fs.cpSync(ROOT_CODEX_PLUGIN_DIR_PATH, STAGED_CODEX_PLUGIN_DIR_PATH, { recursive: true });

  getCodexPluginAssetPaths(codexPluginManifest).forEach((relativePath) => {
    copyRelativeFile(relativePath);
  });
}

function syncMarketplacePluginMirror(codexPluginManifest) {
  fs.rmSync(path.join(ROOT_MARKETPLACE_PLUGIN_ROOT, 'skills'), { recursive: true, force: true });
  fs.rmSync(path.join(ROOT_MARKETPLACE_PLUGIN_ROOT, '.codex-plugin'), { recursive: true, force: true });
  fs.rmSync(path.join(ROOT_MARKETPLACE_PLUGIN_ROOT, 'assets'), { recursive: true, force: true });

  fs.cpSync(ROOT_SKILLS_PATH, path.join(ROOT_MARKETPLACE_PLUGIN_ROOT, 'skills'), { recursive: true });
  writeJson(ROOT_MARKETPLACE_PLUGIN_JSON_PATH, codexPluginManifest);
  getCodexPluginAssetPaths(codexPluginManifest).forEach((relativePath) => {
    copyRelativeFileToRoot(relativePath, ROOT_MARKETPLACE_PLUGIN_ROOT);
  });
}

function cleanStagedPluginBundle() {
  fs.rmSync(STAGED_SKILLS_PATH, { recursive: true, force: true });
  fs.rmSync(STAGED_SKILLS_JSON_PATH, { force: true });
  fs.rmSync(STAGED_CLAUDE_PLUGIN_DIR_PATH, { recursive: true, force: true });
  fs.rmSync(STAGED_CODEX_PLUGIN_DIR_PATH, { recursive: true, force: true });

  if (fs.existsSync(ROOT_CODEX_PLUGIN_JSON_PATH)) {
    getCodexPluginAssetPaths().forEach((relativePath) => {
      removeFileAndEmptyParents(path.join(PACKAGE_ROOT, relativePath), PACKAGE_ROOT);
    });
  }
}

module.exports = {
  PACKAGE_ROOT,
  REPO_ROOT,
  ROOT_CLAUDE_PLUGIN_JSON_PATH,
  ROOT_CODEX_PLUGIN_JSON_PATH,
  ROOT_MARKETPLACE_PLUGIN_JSON_PATH,
  ROOT_MARKETPLACE_PLUGIN_ROOT,
  ROOT_SKILLS_JSON_PATH,
  STAGED_CLAUDE_PLUGIN_JSON_PATH,
  STAGED_CODEX_PLUGIN_JSON_PATH,
  STAGED_SKILLS_JSON_PATH,
  applySharedPluginMetadata,
  buildAlignedBundle,
  cleanStagedPluginBundle,
  ensureBundleIsAligned,
  getCodexPluginAssetPaths,
  getPackageJson,
  readJson,
  stagePluginBundle,
  syncMarketplacePluginMirror,
  syncBundleMetadata
};
