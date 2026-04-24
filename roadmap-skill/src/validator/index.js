'use strict';

const path = require('path');
const fs = require('fs');
const { walkFiles, detectTestFrameworks } = require('../io');
const { collectPluginContributions } = require('../config');
const { escapeRegExp, tokenize } = require('../utils');

const CODE_EXTENSIONS = new Set([
  '.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.py', '.go', '.rs', '.java', '.kt', '.swift', '.rb', '.php', '.cs'
]);

const DOC_HINTS = ['readme', 'changelog', 'docs', 'documentation', 'spec', 'diagram', 'runbook'];
const CODE_HINTS = ['implement', 'add', 'create', 'build', 'refactor', 'fix', 'module', 'function', 'api', 'endpoint', 'command'];
const GENERIC_TASK_TOKENS = new Set([
  'implement',
  'implementation',
  'module',
  'function',
  'class',
  'method',
  'command',
  'create',
  'add',
  'build',
  'refactor',
  'fix',
  'test',
  'tests'
]);

function readFileIndex(projectRoot, files) {
  const index = [];
  for (const relativePath of files) {
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
  for (const token of pathTokens) {
    results.add(token);
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
  return DOC_HINTS.some((hint) => normalized.includes(hint));
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
    .filter((token) => token.length >= 3 && !GENERIC_TASK_TOKENS.has(token))
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

    const threshold = tokens.length === 1 ? 1 : 2;
    if (score >= threshold) {
      matches.push(file.relativePath);
    }
  }

  return matches.slice(0, 20);
}

function findTestEvidence(taskText, fileIndex) {
  const tokens = tokenize(taskText)
    .filter((token) => token.length >= 3 && !GENERIC_TASK_TOKENS.has(token))
    .slice(0, 8);
  const matches = [];

  for (const file of fileIndex) {
    if (!file.isTestFile) {
      continue;
    }
    const lowered = file.content.toLowerCase();
    const hasMatch = tokens.some((token) => lowered.includes(token));
    if (hasMatch) {
      matches.push(file.relativePath);
    }
  }

  return matches.slice(0, 20);
}

function findArtifactEvidence(taskText, fileIndex) {
  const normalized = String(taskText).toLowerCase();
  const matches = [];

  if (!isDocTask(taskText) && !normalized.includes('artifact') && !normalized.includes('release')) {
    return matches;
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
    if (artifactPatterns.some((pattern) => pattern.test(file.relativePath))) {
      matches.push(file.relativePath);
    }
  }

  return matches.slice(0, 20);
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
  const filesFromArtifacts = findArtifactEvidence(task.text, context.fileIndex);

  const evidence = {
    code: filesFromCode.length > 0 || filesFromSymbols.length > 0,
    test: filesFromTests.length > 0,
    artifact: filesFromArtifacts.length > 0,
    files: filesFromPaths,
    symbols: filesFromSymbols,
    codeFiles: filesFromCode,
    testFiles: filesFromTests,
    artifactFiles: filesFromArtifacts
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

  return {
    taskId: task.id,
    passed: uniqueReasons.length === 0,
    reasons: uniqueReasons,
    evidence,
    requiresTest,
    hasEvidence,
    attempted: hasEvidence || pathHints.length > 0 || symbolHints.length > 0
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

  for (const task of tasks) {
    const result = results[task.id];
    if (!result) {
      continue;
    }

    if (task.checked && !result.passed) {
      checkedWithoutEvidence.push({ task, result });
    }

    if (!task.checked && result.passed) {
      readyButUnchecked.push({ task, result });
    }
  }

  return {
    checkedWithoutEvidence,
    readyButUnchecked
  };
}

module.exports = {
  auditValidation,
  buildValidationContext,
  validateTask,
  validateTasks
};
