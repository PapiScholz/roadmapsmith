'use strict';

const path = require('path');
const fs = require('fs');
const { walkFiles, detectTestFrameworks } = require('../io');
const { collectPluginContributions } = require('../config');
const { escapeRegExp, tokenize } = require('../utils');

const CONFIDENCE_RANK = { low: 0, medium: 1, high: 2 };

const CODE_EXTENSIONS = new Set([
  '.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.py', '.go', '.rs', '.java', '.kt', '.swift', '.rb', '.php', '.cs'
]);

// "docs" omitted from DOC_HINTS — it is a path prefix in scan tasks, not a doc-authoring keyword.
const DOC_HINTS = ['readme', 'changelog', 'documentation', 'spec', 'diagram', 'runbook'];
const CODE_HINTS = ['implement', 'add', 'create', 'build', 'refactor', 'fix', 'module', 'function', 'api', 'endpoint', 'command'];
const GENERIC_TASK_TOKENS = new Set([
  // Action verbs too broad to be evidence signals
  'implement', 'implementation', 'create', 'add', 'build', 'refactor', 'fix',
  'detect', 'detection', 'support', 'handle', 'handler', 'update', 'check', 'run',
  'process', 'processing', 'generate', 'generation', 'format', 'report',
  // Structural concepts shared by every codebase
  'module', 'function', 'class', 'method', 'command', 'type', 'value', 'values',
  'output', 'input', 'data',
  // Test vocabulary
  'test', 'tests',
  // Infrastructure names present in nearly every Node/JS project
  'config', 'configuration', 'package', 'json', 'project', 'roadmap',
  // Domain words specific to this tool that appear in non-feature source files
  'confidence', 'profile', 'validation', 'evidence',
  // Package/module field names that appear naturally in any Node.js generator or config file
  'main', 'exports', 'files', 'fields', 'without', 'field',
  // Terminology used in architecture/detection task descriptions that overlaps with source identifiers
  'signals', 'directory', 'directories', 'headers', 'site', 'shebang',
  // Common directory names that appear in import paths ('src', 'lib', 'bin') — too generic for evidence
  'src', 'lib',
]);

const CANONICAL_FILES = {
  security: 'SECURITY.md',
  readme: 'README.md',
  changelog: 'CHANGELOG.md',
  license: 'LICENSE'
};

// The roadmap file must never be included in the evidence pool: its task descriptions
// contain the exact vocabulary of the tasks being validated, which would cause every
// task to validate itself.
const SELF_REFERENTIAL_FILES = new Set(['ROADMAP.md']);

function readFileIndex(projectRoot, files) {
  const index = [];
  for (const relativePath of files) {
    if (SELF_REFERENTIAL_FILES.has(relativePath)) continue;

    const absolutePath = path.resolve(projectRoot, relativePath);
    const ext = path.extname(relativePath).toLowerCase();
    let content = '';
    try {
      const buffer = fs.readFileSync(absolutePath);
      if (buffer.length > 512 * 1024) {
        continue;
      }
      content = buffer.toString('utf8');
    } catch {
      continue;
    }

    index.push({
      relativePath,
      absolutePath,
      ext,
      content,
      isTestFile: /(^|\/)(__tests__|tests)\//.test(relativePath) || /\.test\.|\.spec\.|_test\.go$/.test(relativePath)
    });
  }
  return index;
}

const KNOWN_PATH_ROOTS = [
  'src/', 'lib/', 'bin/', 'test/', 'tests/', 'docs/', 'scripts/',
  'packages/', 'apps/', 'tools/', '.github/', 'roadmap-skill/'
];

function hasFileExtension(token) {
  const lastSegment = token.replace(/\\/g, '/').split('/').pop() || '';
  return /\.[A-Za-z0-9]{1,10}$/.test(lastSegment);
}

function isLikelyPath(token) {
  if (/^\.{1,2}\/|^\//.test(token)) return true;
  if (hasFileExtension(token)) return true;
  if (KNOWN_PATH_ROOTS.some((root) => token.startsWith(root))) return true;
  // The ">= 2 slashes" rule was intentionally removed: it caused conceptual slash phrases
  // like "code/test/artifact" or "build/test/deploy" to be treated as file paths.
  // Real multi-segment paths are caught by the extension or known-root rules above.
  return false;
}

function extractExplicitPaths(text) {
  const results = new Set();
  const quoted = String(text).match(/`([^`]+)`/g) || [];
  for (const token of quoted) {
    const clean = token.slice(1, -1);
    if (clean.includes('/') || clean.includes('\\') || clean.includes('.')) {
      results.add(clean);
    }
  }

  const pathTokens = String(text).match(/([A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+)/g) || [];
  for (const raw of pathTokens) {
    const token = raw.replace(/[.,;:!?)]+$/, '');
    if (isLikelyPath(token)) results.add(token);
  }

  return Array.from(results).sort((left, right) => left.localeCompare(right));
}

function extractSymbolHints(text) {
  const symbols = new Set();
  const patterns = [
    /(?:function|class|method|command)\s+([A-Za-z_][A-Za-z0-9_]*)/gi,
    /(?:function|module|class|command|method)\s+`([A-Za-z_][A-Za-z0-9_-]*)`/gi,
    /`([A-Za-z_][A-Za-z0-9_-]*)`\s+(?:function|module|class|command|method)/gi
  ];

  for (const pattern of patterns) {
    let match = pattern.exec(text);
    while (match) {
      symbols.add(match[1]);
      match = pattern.exec(text);
    }
  }

  return Array.from(symbols).sort((left, right) => left.localeCompare(right));
}

function isCodeTask(taskText) {
  const normalized = String(taskText).toLowerCase();
  return CODE_HINTS.some((hint) => normalized.includes(hint));
}

function isDocTask(taskText) {
  const normalized = String(taskText).toLowerCase();
  // Use word-boundary matching to avoid substring false positives (e.g. "specific" ≠ "spec").
  const hasDocKeyword = DOC_HINTS.some((hint) => new RegExp(`(?<![a-z])${hint}(?![a-z])`).test(normalized));
  if (!hasDocKeyword) return false;
  // Also require a creation/update verb so that policy tasks mentioning doc files
  // ("README must not be used as evidence") don't trigger doc-artifact evidence.
  return /\b(add|create|write|update|init|initialize|introduce|setup|document)\b/.test(normalized);
}

function findFilesByPathHints(pathHints, fileIndex) {
  const matches = [];
  for (const hint of pathHints) {
    const normalizedHint = hint.replace(/\\/g, '/');
    const direct = fileIndex.find((file) => file.relativePath === normalizedHint);
    if (direct) {
      matches.push(direct.relativePath);
      continue;
    }

    for (const file of fileIndex) {
      if (file.relativePath.endsWith(normalizedHint)) {
        matches.push(file.relativePath);
      }
    }
  }
  return Array.from(new Set(matches)).sort((left, right) => left.localeCompare(right));
}

function findFilesBySymbols(symbolHints, fileIndex) {
  const matches = new Set();
  for (const symbol of symbolHints) {
    const regex = new RegExp(`\\b${escapeRegExp(symbol)}\\b`, 'i');
    for (const file of fileIndex) {
      if (!CODE_EXTENSIONS.has(file.ext)) {
        continue;
      }
      if (regex.test(file.content)) {
        matches.add(file.relativePath);
      }
    }
  }
  return Array.from(matches).sort((left, right) => left.localeCompare(right));
}

function findCodeEvidence(taskText, fileIndex) {
  const tokens = tokenize(taskText)
    .filter((token) => token.length >= 3 && !GENERIC_TASK_TOKENS.has(token) && !token.endsWith('/'))
    .slice(0, 8);
  if (tokens.length === 0) {
    return [];
  }

  const matches = [];
  for (const file of fileIndex) {
    if (!CODE_EXTENSIONS.has(file.ext) || file.isTestFile) {
      continue;
    }

    let score = 0;
    const lowered = file.content.toLowerCase();
    for (const token of tokens) {
      if (token.length < 3) {
        continue;
      }
      if (lowered.includes(token)) {
        score += 1;
      }
    }

    // Require more matches proportional to how many specific tokens the task has.
    // Tasks with 4+ meaningful tokens need 3 files to match to prevent vocabulary overlap.
    const threshold = tokens.length >= 4 ? 3 : tokens.length >= 2 ? 2 : 1;
    if (score >= threshold) {
      matches.push(file.relativePath);
    }
  }

  return matches.slice(0, 20);
}

function findTestEvidence(taskText, fileIndex) {
  const tokens = tokenize(taskText)
    .filter((token) => token.length >= 3 && !GENERIC_TASK_TOKENS.has(token) && !token.endsWith('/'))
    .slice(0, 8);

  if (tokens.length === 0) return [];

  // Only tokens of length >= 4 are used for import-reference matching.
  // Very short tokens (e.g. "app", "web") are too generic: they appear as substrings in
  // many import paths that have nothing to do with the feature being validated.
  // The single-short-token fallback below handles the narrow case of one-word module names.
  const importTokens = tokens.filter((token) => token.length >= 4);

  const matches = [];

  for (const file of fileIndex) {
    if (!file.isTestFile) continue;

    // A test file counts as evidence only when it imports a module whose path contains
    // one of the task's meaningful tokens. Content-keyword matching is intentionally absent:
    // test content (descriptions, literals) can contain future-task vocabulary,
    // producing self-referential false positives.
    //
    // Trailing slashes are NOT stripped: "app/" is a directory reference, not a module name.
    // "../src/app" (a real import) does not contain the string "app/" so it won't match.
    const importRefs = (
      file.content.match(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)|from\s+['"`]([^'"`]+)['"`]/g) || []
    ).join(' ').toLowerCase();

    if (importTokens.length > 0 && importTokens.some((token) => importRefs.includes(token))) {
      matches.push(file.relativePath);
      continue;
    }

    // Narrow fallback: single very-short token (e.g. "app", "cli").
    // Import paths for these are too short to distinguish reliably, so fall back to a
    // content match — but only when there is exactly one such token (no multi-token dilution).
    if (tokens.length === 1 && tokens[0].length < 4) {
      const lowered = file.content.toLowerCase();
      if (lowered.includes(tokens[0])) {
        matches.push(file.relativePath);
      }
    }
  }

  return matches.slice(0, 20);
}

function findArtifactEvidence(taskText, fileIndex) {
  const normalized = String(taskText).toLowerCase();
  const files = [];
  const heuristicArtifacts = [];

  // Canonical file detection only applies to short tasks (≤8 words) that are about
  // creating or referencing that specific file. Long sentences that merely MENTION
  // "readme" or "security" in a policy/constraint context are excluded.
  const wordCount = normalized.trim().split(/\s+/).length;
  if (wordCount <= 8) {
    for (const [keyword, filename] of Object.entries(CANONICAL_FILES)) {
      // Use hyphen-aware word boundaries: "security-headers" must not match "security".
      if (new RegExp(`(?<![a-z-])${keyword}(?![a-z-])`).test(normalized)) {
        const hit = fileIndex.find(
          (f) => f.relativePath === filename || f.relativePath.endsWith('/' + filename)
        );
        if (hit) {
          files.push(hit.relativePath);
          heuristicArtifacts.push(hit.relativePath);
        }
      }
    }
  }

  if (!isDocTask(taskText)) {
    return { files, heuristicArtifacts };
  }

  const artifactPatterns = [
    /^README\.md$/i,
    /^CHANGELOG\.md$/i,
    /^docs\//i,
    /^artifacts\//i,
    /^dist\//i,
    /^build\//i
  ];

  for (const file of fileIndex) {
    if (artifactPatterns.some((pattern) => pattern.test(file.relativePath)) && !files.includes(file.relativePath)) {
      files.push(file.relativePath);
    }
  }

  return { files: files.slice(0, 20), heuristicArtifacts };
}

function evaluateRule(rule, task, context) {
  if (!rule) {
    return { passed: true, reasons: [], evidence: {} };
  }

  if (rule.when) {
    const regexp = new RegExp(rule.when, 'i');
    if (!regexp.test(task.text)) {
      return { passed: true, reasons: [], evidence: {} };
    }
  }

  if (typeof rule.check === 'function') {
    const custom = rule.check(task, context);
    if (!custom) {
      return { passed: true, reasons: [], evidence: {} };
    }
    return {
      passed: custom.passed !== false,
      reasons: Array.isArray(custom.reasons) ? custom.reasons : [],
      evidence: custom.evidence || {}
    };
  }

  const reasons = [];
  const evidence = {};

  if (rule.type === 'file-exists' && rule.path) {
    const hit = context.fileIndex.find((file) => file.relativePath === rule.path || file.relativePath.endsWith(rule.path));
    if (!hit) {
      reasons.push(rule.message || `missing file: ${rule.path}`);
    } else {
      evidence.file = hit.relativePath;
    }
  }

  if (rule.type === 'symbol' && rule.pattern) {
    const regex = new RegExp(rule.pattern, 'i');
    const hit = context.fileIndex.find((file) => regex.test(file.content));
    if (!hit) {
      reasons.push(rule.message || `missing symbol pattern: ${rule.pattern}`);
    } else {
      evidence.symbol = hit.relativePath;
    }
  }

  if (rule.type === 'artifact' && rule.path) {
    const hit = context.fileIndex.find((file) => file.relativePath.startsWith(rule.path) || file.relativePath === rule.path);
    if (!hit) {
      reasons.push(rule.message || `missing artifact: ${rule.path}`);
    } else {
      evidence.artifact = hit.relativePath;
    }
  }

  if (rule.type === 'test' && context.testFrameworks.length === 0) {
    reasons.push(rule.message || 'test framework not detected');
  }

  return {
    passed: reasons.length === 0,
    reasons,
    evidence
  };
}

function buildValidationContext(projectRoot, config, plugins) {
  const files = walkFiles(projectRoot);
  const fileIndex = readFileIndex(projectRoot, files);
  const testFrameworks = detectTestFrameworks(projectRoot, files);

  return {
    projectRoot,
    config,
    plugins,
    files,
    fileIndex,
    testFrameworks
  };
}

function validateTask(task, context, config, plugins) {
  const pathHints = extractExplicitPaths(task.text);
  const symbolHints = extractSymbolHints(task.text);

  const filesFromPaths = findFilesByPathHints(pathHints, context.fileIndex);
  const filesFromSymbols = findFilesBySymbols(symbolHints, context.fileIndex);
  const filesFromCode = findCodeEvidence(task.text, context.fileIndex);
  const filesFromTests = findTestEvidence(task.text, context.fileIndex);
  const { files: filesFromArtifacts, heuristicArtifacts } = findArtifactEvidence(task.text, context.fileIndex);

  const evidence = {
    code: filesFromCode.length > 0 || filesFromSymbols.length > 0,
    test: filesFromTests.length > 0,
    artifact: filesFromArtifacts.length > 0,
    files: filesFromPaths,
    symbols: filesFromSymbols,
    codeFiles: filesFromCode,
    testFiles: filesFromTests,
    artifactFiles: filesFromArtifacts,
    heuristicArtifacts
  };

  const reasons = [];
  if (pathHints.length > 0 && filesFromPaths.length === 0) {
    reasons.push(`missing referenced file(s): ${pathHints.join(', ')}`);
  }
  if (symbolHints.length > 0 && filesFromSymbols.length === 0) {
    reasons.push(`missing symbol(s): ${symbolHints.join(', ')}`);
  }

  const hasEvidence = evidence.code || evidence.test || evidence.artifact || evidence.files.length > 0;
  if (!hasEvidence) {
    reasons.push('no code, test, or artifact evidence found');
  }

  const requiresTest = context.testFrameworks.length > 0 && isCodeTask(task.text) && !isDocTask(task.text);
  if (requiresTest && !evidence.test) {
    reasons.push('missing test evidence');
  }

  const configuredRules = Array.isArray(config.validators) ? config.validators : [];
  const pluginRules = collectPluginContributions(plugins || [], 'registerValidators', context);
  for (const rule of [...configuredRules, ...pluginRules]) {
    const ruleResult = evaluateRule(rule, task, context);
    if (!ruleResult.passed) {
      reasons.push(...ruleResult.reasons);
    }
  }

  const uniqueReasons = Array.from(new Set(reasons));
  const attempted = hasEvidence || pathHints.length > 0 || symbolHints.length > 0;

  const evidenceCount = [evidence.code, evidence.test, evidence.artifact].filter(Boolean).length;
  const confidence = evidenceCount >= 2 ? 'high' : evidenceCount === 1 ? 'medium' : 'low';

  // True when the only passing evidence is artifact/doc files and the task is not a doc task.
  // Used by auditValidation to flag implementation tasks that pass solely via documentation.
  const evidenceIsDocOnly = !evidence.code && !evidence.test && evidence.artifact && !isDocTask(task.text);

  return {
    taskId: task.id,
    passed: uniqueReasons.length === 0,
    confidence,
    reasons: uniqueReasons,
    evidence,
    evidenceIsDocOnly,
    requiresTest,
    hasEvidence,
    attempted
  };
}

function validateTasks(tasks, context, config, plugins) {
  const result = {};
  for (const task of tasks) {
    result[task.id] = validateTask(task, context, config, plugins);
  }
  return result;
}

function auditValidation(tasks, results) {
  const checkedWithoutEvidence = [];
  const readyButUnchecked = [];
  const checkedWithWeakEvidence = [];
  const documentationOnlyEvidenceForImplementation = [];

  for (const task of tasks) {
    const result = results[task.id];
    if (!result) continue;

    if (task.checked && !result.passed) {
      checkedWithoutEvidence.push({ task, result });
    }

    if (!task.checked && result.passed) {
      readyButUnchecked.push({ task, result });
    }

    // Checked and passing, but only via low-confidence evidence (e.g. token overlap only).
    if (task.checked && result.passed && result.confidence === 'low') {
      checkedWithWeakEvidence.push({ task, result });
    }

    // Implementation task passing only because documentation files exist — not because source code does.
    if (task.checked && result.passed && result.evidenceIsDocOnly) {
      documentationOnlyEvidenceForImplementation.push({ task, result });
    }
  }

  return {
    checkedWithoutEvidence,
    readyButUnchecked,
    checkedWithWeakEvidence,
    documentationOnlyEvidenceForImplementation,
  };
}

function applyMinimumConfidence(results, minimumConfidence) {
  const minRank = CONFIDENCE_RANK[minimumConfidence] ?? 0;
  if (minRank === 0) return;
  for (const result of Object.values(results)) {
    if ((CONFIDENCE_RANK[result.confidence] ?? 0) < minRank) {
      result.passed = false;
      result.reasons = [
        ...result.reasons,
        `validation confidence "${result.confidence}" is below required "${minimumConfidence}"`
      ];
    }
  }
}

module.exports = {
  auditValidation,
  buildValidationContext,
  validateTask,
  validateTasks,
  CONFIDENCE_RANK,
  applyMinimumConfidence
};
