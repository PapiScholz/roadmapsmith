'use strict';

const fs = require('fs');
const path = require('path');
const { ensureTrailingNewline, toPosix } = require('./utils');

const DEFAULT_IGNORED_DIRS = new Set([
  '.git',
  '.idea',
  '.vscode',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  'dist',
  'build',
  'coverage',
  'target',
  'node_modules',
  '.venv',
  'venv',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache'
]);

function readTextIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function ensureDirForFile(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function writeText(filePath, content, options = {}) {
  const next = ensureTrailingNewline(content);
  const before = readTextIfExists(filePath);
  const changed = before == null || before !== next;

  if (!changed) {
    return {
      changed: false,
      before,
      after: next,
      path: filePath
    };
  }

  if (!options.dryRun) {
    ensureDirForFile(filePath);
    fs.writeFileSync(filePath, next, 'utf8');
  }

  return {
    changed: true,
    before,
    after: next,
    path: filePath
  };
}

function walkFiles(rootPath, options = {}) {
  const ignoredDirs = options.ignoredDirs || DEFAULT_IGNORED_DIRS;
  const result = [];

  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      const relativePath = toPosix(path.relative(rootPath, absolutePath));
      if (entry.isDirectory()) {
        if (ignoredDirs.has(entry.name)) {
          continue;
        }
        walk(absolutePath);
        continue;
      }
      result.push(relativePath);
    }
  }

  walk(rootPath);
  return result;
}

function parseJsonIfExists(filePath) {
  const content = readTextIfExists(filePath);
  if (!content) {
    return null;
  }
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function detectLanguages(files) {
  const languageByExtension = {
    '.js': 'JavaScript',
    '.cjs': 'JavaScript',
    '.mjs': 'JavaScript',
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript',
    '.jsx': 'JavaScript',
    '.py': 'Python',
    '.go': 'Go',
    '.rs': 'Rust',
    '.java': 'Java',
    '.kt': 'Kotlin',
    '.swift': 'Swift',
    '.rb': 'Ruby',
    '.php': 'PHP',
    '.cs': 'C#',
    '.cpp': 'C++',
    '.c': 'C',
    '.h': 'C',
    '.sh': 'Shell'
  };

  const languages = new Set();
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (languageByExtension[ext]) {
      languages.add(languageByExtension[ext]);
    }
  }
  return Array.from(languages).sort((left, right) => left.localeCompare(right));
}

function detectTestFrameworks(projectRoot, files) {
  const frameworks = new Set();

  const packageJson = parseJsonIfExists(path.join(projectRoot, 'package.json'));
  if (packageJson) {
    const scripts = packageJson.scripts || {};
    if (scripts.test) {
      frameworks.add('node-test-script');
    }
    const deps = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {})
    };
    if (deps.jest) frameworks.add('jest');
    if (deps.vitest) frameworks.add('vitest');
    if (deps.mocha) frameworks.add('mocha');
    if (deps.ava) frameworks.add('ava');
    if (deps.tap) frameworks.add('tap');
  }

  if (files.some((file) => file.endsWith('pyproject.toml')) || files.some((file) => file.endsWith('pytest.ini'))) {
    frameworks.add('pytest');
  }
  if (files.some((file) => /(^|\/)test_.*\.py$/.test(file)) || files.some((file) => /(^|\/)tests\//.test(file))) {
    frameworks.add('python-tests');
  }
  if (files.some((file) => file.endsWith('go.mod'))) {
    frameworks.add('go');
  }
  if (files.some((file) => file.endsWith('_test.go'))) {
    frameworks.add('go-test');
  }
  if (files.some((file) => file.endsWith('Cargo.toml'))) {
    frameworks.add('rust');
  }
  if (files.some((file) => /(^|\/)tests\//.test(file) && file.endsWith('.rs'))) {
    frameworks.add('cargo-test');
  }

  if (files.some((file) => /(^|\/)(__tests__|tests)\//.test(file) || /\.test\.|\.spec\./.test(file))) {
    frameworks.add('generic-tests');
  }

  return Array.from(frameworks).sort((left, right) => left.localeCompare(right));
}

function lineDiff(before, after) {
  const left = (before || '').split(/\r?\n/);
  const right = (after || '').split(/\r?\n/);
  const max = Math.max(left.length, right.length);
  const changes = [];

  for (let i = 0; i < max; i += 1) {
    const oldLine = left[i] == null ? '' : left[i];
    const newLine = right[i] == null ? '' : right[i];
    if (oldLine !== newLine) {
      changes.push({ index: i + 1, oldLine, newLine });
    }
    if (changes.length >= 20) {
      break;
    }
  }

  return changes;
}

function printDryRunDiff(filePath, before, after) {
  const changes = lineDiff(before, after);
  console.log(`Dry run: ${filePath}`);
  if (changes.length === 0) {
    console.log('- no line changes');
    return;
  }

  for (const change of changes) {
    console.log(`L${change.index} - ${change.oldLine}`);
    console.log(`L${change.index} + ${change.newLine}`);
  }
}

module.exports = {
  detectLanguages,
  detectTestFrameworks,
  printDryRunDiff,
  readTextIfExists,
  walkFiles,
  writeText
};
