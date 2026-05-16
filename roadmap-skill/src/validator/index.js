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
const TRANSLATION_DIR_SEGMENTS = ['locale', 'locales', 'i18n', 'translations'];
const DEFAULT_EXCLUDED_PATH_PREFIXES = ['.claude/', '.agent/', 'roadmap-skill/'];

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
  // Common directory names that appear in import paths — too generic for evidence
  'src', 'lib',
  // Broad task-description verbs and nouns that pollute evidence matching across every codebase
  'task', 'tasks', 'file', 'source', 'code', 'artifact', 'artifacts',
  'generic', 'feature', 'features', 'section', 'sections',
  'user', 'users', 'workflow', 'workflows', 'mode', 'modes', 'replace',
  // Tool-internal vocabulary that appears in non-feature implementation files
  'audit', 'debug', 'signal', 'signals', 'log',
  // English stopwords and function words that appear everywhere — not useful as evidence signals
  'only', 'must', 'what', 'which', 'kind', 'never', 'also', 'each',
  'detected', 'generated', 'existing', 'available',
  // Tool-commentary vocabulary that appears in source comments but describes past/intended behavior
  'phrases', 'conceptual',
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

// Maps task-ID namespace prefix to a predicate on (normalized) file paths.
// When a task ID has a known namespace, at least one evidence file must satisfy
// the predicate — otherwise generic token overlap alone cannot pass the task.
const NAMESPACE_STRUCTURAL_PATTERNS = {
  cls:  (p) => /classif(?:ier|y)|archetype/.test(p),
  dsg:  (p) => /generator[/\\](?:domain|web|landing|profiles?)|(?:domain|web|landing)[/\\](?:profile|generator)/.test(p),
  evh2: (p) => p.includes('/validator/') || p.includes('\\validator\\'),
  cst:  (p) => /smoke|integration[-_]test|e2e/.test(p),
  uxf:  (p) => p.includes('/renderer/') || p.includes('\\renderer\\') || /renderer\.[jt]sx?$/.test(p),
  cfgo: (p) => /config[/\\]|schema[/\\]|config\.[jt]s$|schema\.[jt]s$/.test(p),
  doc3: (p) => /(?:^|[/\\])docs[/\\]|readme\.md$/i.test(p),
};

// Test fixture directories contain synthetic code created to drive test scenarios,
// not real implementations. Including them pollutes the evidence pool with vocabulary
// that was deliberately seeded for testing purposes (e.g. namespace-vocab fixtures).
function isFixturePath(relativePath) {
  return /(?:^|[/\\])fixtures[/\\]/.test(relativePath);
}

function normalizePathForMatch(rawPath) {
  return String(rawPath || '').replace(/\\/g, '/').toLowerCase();
}

function shouldExcludeByDefaultPath(relativePath, config) {
  const normalized = normalizePathForMatch(relativePath);
  if (DEFAULT_EXCLUDED_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return true;
  }

  const configuredSkillsDir = config && typeof config.skillsDir === 'string'
    ? normalizePathForMatch(config.skillsDir).replace(/^\.?\//, '')
    : '';
  if (configuredSkillsDir && (normalized === configuredSkillsDir || normalized.startsWith(configuredSkillsDir + '/'))) {
    return true;
  }
  return false;
}

function isTranslationPath(relativePath) {
  const normalized = normalizePathForMatch(relativePath);
  const segments = normalized.split('/').filter(Boolean);
  return segments.some((segment) => TRANSLATION_DIR_SEGMENTS.includes(segment));
}

function looksLikeTranslationJson(content) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return false;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return false;
  }

  const values = Object.values(parsed);
  if (values.length === 0) return false;
  const stringValues = values.filter((value) => typeof value === 'string').length;
  return stringValues / values.length >= 0.8;
}

function isMostlyUiStrings(content) {
  const lines = String(content).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 5) return false;
  const stringLikeLines = lines.filter((line) => /^['"`][^'"`]{1,200}['"`],?$/.test(line) || /^[A-Za-z0-9_.-]+\s*:\s*['"`][^'"`]{1,200}['"`],?$/.test(line)).length;
  return stringLikeLines / lines.length > 0.8;
}

function readFileIndex(projectRoot, files, config) {
  const index = [];
  for (const relativePath of files) {
    if (SELF_REFERENTIAL_FILES.has(relativePath)) continue;
    if (isFixturePath(relativePath)) continue;
    if (shouldExcludeByDefaultPath(relativePath, config)) continue;

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

    if (isTranslationPath(relativePath)) continue;
    if (ext === '.json' && looksLikeTranslationJson(content)) continue;
    if (isMostlyUiStrings(content)) continue;

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

// Matches standalone filenames without a slash — e.g. "roadmap-skill.config.json",
// "package.json", "vite.config.ts". These are path references whose component tokens
// (e.g. "roadmap", "skill") must be excluded from code evidence scoring to prevent
// circular vocabulary: a task mentioning a filename would otherwise score hits in any
// source file that happens to reference the same filename for unrelated reasons.
// Numeric-only tokens like "1.0.0" or "v0.8" are excluded via the leading-digit guard.
const STANDALONE_FILE_RE = /\b([A-Za-z][A-Za-z0-9_.+-]*\.[A-Za-z0-9]{2,10})\b/g;
const KNOWN_FILE_EXTENSIONS = new Set([
  '.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.py', '.go', '.rs',
  '.java', '.kt', '.swift', '.rb', '.php', '.cs', '.json', '.yaml', '.yml',
  '.toml', '.md', '.txt', '.sh', '.bash', '.env', '.html', '.css', '.scss', '.lock'
]);

function hasKnownFileExtension(token) {
  const lastDot = token.lastIndexOf('.');
  if (lastDot < 0) return false;
  return KNOWN_FILE_EXTENSIONS.has(token.slice(lastDot).toLowerCase());
}

function isAsciiAlphaNumeric(char) {
  if (!char || char.length === 0) return false;
  const code = char.charCodeAt(0);
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isPathTokenCharacter(char) {
  return isAsciiAlphaNumeric(char) || char === '.' || char === '_' || char === '-' || char === '/' || char === '\\';
}

function stripTrailingPathPunctuation(token) {
  let result = String(token || '');
  while (result.length > 0) {
    const lastChar = result[result.length - 1];
    if (lastChar !== '.' && lastChar !== ',' && lastChar !== ';' && lastChar !== ':' && lastChar !== '!' && lastChar !== '?' && lastChar !== ')') {
      break;
    }
    result = result.slice(0, -1);
  }
  return result;
}

function collectPathishTokens(text) {
  const tokens = [];
  let current = '';
  const source = String(text || '');
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (isPathTokenCharacter(char)) {
      current += char;
      continue;
    }
    if (current) {
      tokens.push(stripTrailingPathPunctuation(current));
      current = '';
    }
  }
  if (current) {
    tokens.push(stripTrailingPathPunctuation(current));
  }
  return tokens.filter(Boolean);
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

  const pathTokens = String(text).match(/([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+)/g) || [];
  for (const raw of pathTokens) {
    const token = stripTrailingPathPunctuation(raw);
    if (isLikelyPath(token)) results.add(token);
  }

  return Array.from(results).sort((left, right) => left.localeCompare(right));
}

// Standalone filenames (no slash) mentioned in task prose — e.g. "roadmap-skill.config.json",
// "package.json". These are filename *references*, NOT path-existence assertions: the author
// is describing which file contains a feature, not asserting that the file must exist.
// Used only for pathDerivedToken extraction (to prevent circular vocabulary), never for
// findFilesByPathHints (which would pass any task whose config file already exists).
function extractStandaloneFilenames(text) {
  const results = new Set();
  STANDALONE_FILE_RE.lastIndex = 0;
  let m = STANDALONE_FILE_RE.exec(String(text));
  while (m) {
    const token = stripTrailingPathPunctuation(m[1]);
    if (hasKnownFileExtension(token) && !token.startsWith('.')) {
      results.add(token);
    }
    m = STANDALONE_FILE_RE.exec(String(text));
  }
  return Array.from(results);
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

function findFilesByTaskPathTokens(taskText, fileIndex, pathDerivedTokens = new Set()) {
  const tokens = tokenize(taskText)
    .filter((token) => token.length >= 6 && !GENERIC_TASK_TOKENS.has(token) && !pathDerivedTokens.has(token))
    .slice(0, 10);
  if (tokens.length === 0) return [];

  const matches = new Set();
  for (const file of fileIndex) {
    const pathSegments = normalizePathForMatch(file.relativePath).split('/').filter(Boolean);
    for (const token of tokens) {
      if (pathSegments.some((segment) => segment === token || segment.includes(token))) {
        matches.add(file.relativePath);
        break;
      }
    }
    if (matches.size >= 20) break;
  }
  return Array.from(matches).sort((left, right) => left.localeCompare(right));
}

function extractTaskEvidenceTokens(taskText, pathDerivedTokens = new Set()) {
  return tokenize(taskText)
    .filter((token) => token.length >= 3 && !GENERIC_TASK_TOKENS.has(token) && !token.endsWith('/') && !pathDerivedTokens.has(token))
    .slice(0, 8);
}

function findWeakPathContentSpecificTokens(taskText, fileIndex, weakPathFiles, pathDerivedTokens = new Set()) {
  const tokens = extractTaskEvidenceTokens(taskText, pathDerivedTokens);
  if (tokens.length === 0 || weakPathFiles.length === 0) return [];

  const weakFiles = new Set(weakPathFiles);
  const matches = new Set();
  for (const file of fileIndex) {
    if (!weakFiles.has(file.relativePath) || !CODE_EXTENSIONS.has(file.ext) || file.isTestFile) {
      continue;
    }

    const normalizedPath = normalizePathForMatch(file.relativePath);
    const lowered = file.content.toLowerCase();
    for (const token of tokens) {
      if (normalizedPath.includes(token)) {
        continue;
      }
      if (lowered.includes(token)) {
        matches.add(token);
      }
    }
  }

  return Array.from(matches).sort((left, right) => left.localeCompare(right));
}

function mergeRuleEvidence(baseEvidence, ruleEvidence) {
  if (!ruleEvidence || typeof ruleEvidence !== 'object') return baseEvidence;
  const merged = { ...baseEvidence };

  for (const [key, value] of Object.entries(ruleEvidence)) {
    if (Array.isArray(value)) {
      const existing = Array.isArray(merged[key]) ? merged[key] : [];
      merged[key] = Array.from(new Set([...existing, ...value]));
      continue;
    }
    if (typeof value === 'boolean') {
      merged[key] = Boolean(merged[key]) || value;
      continue;
    }
    merged[key] = value;
  }

  return merged;
}

// Tokens extracted from a referenced file path (e.g. "roadmap-skill" from
// "roadmap-skill.config.json") must not be reused as code evidence signals.
// Those tokens appear in any file that mentions the same path — creating circular
// vocabulary where a task about "X in path/to/file" passes because the source
// code references the same path for unrelated reasons.
function extractPathDerivedTokens(pathHints) {
  const tokens = new Set();
  for (const hint of pathHints) {
    // Char-split: "roadmap-skill.config.json" → ["roadmap", "skill", "config", "json"]
    const parts = hint.replace(/[.\-_/\\]/g, ' ').toLowerCase().split(/\s+/).filter(Boolean);
    for (const part of parts) {
      if (part.length >= 3) tokens.add(part);
    }
    // Tokenizer-split: also adds compound tokens the char-split misses, e.g. "roadmap-skill"
    // (the tokenizer preserves hyphens in identifiers; the char-split strips them).
    for (const token of tokenize(hint)) {
      if (token.length >= 3) tokens.add(token);
    }
  }
  return tokens;
}

function findCodeEvidence(taskText, fileIndex, pathDerivedTokens = new Set()) {
  const tokens = extractTaskEvidenceTokens(taskText, pathDerivedTokens);
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

function normalizeReferencedPath(rawPath) {
  return String(rawPath || '').replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
}

function referencedPathMatches(readRef, referencedPath) {
  const normalizedRef = normalizeReferencedPath(readRef);
  const normalizedHint = normalizeReferencedPath(referencedPath);
  if (!normalizedRef || !normalizedHint) return false;
  if (normalizedRef === normalizedHint || normalizedRef.endsWith('/' + normalizedHint)) {
    return true;
  }
  return path.basename(normalizedRef) === normalizedHint || normalizedRef === path.basename(normalizedHint);
}

function extractTestReadReferences(content) {
  const refs = [];
  const lines = String(content || '').split(/\r?\n/);
  for (const line of lines) {
    if (!/\b(?:fs\.)?readFile(?:Sync)?\s*\(/.test(line)) {
      continue;
    }
    const stringLiterals = line.match(/['"`]([^'"`]+)['"`]/g) || [];
    for (const literal of stringLiterals) {
      const value = literal.slice(1, -1);
      if (hasKnownFileExtension(value) || value.includes('/') || value.includes('\\')) {
        refs.push(value);
      }
    }
  }
  return refs;
}

function findTestEvidence(taskText, fileIndex, referencedPaths = []) {
  const tokens = tokenize(taskText)
    .filter((token) => token.length >= 3 && !GENERIC_TASK_TOKENS.has(token) && !token.endsWith('/'))
    .slice(0, 8);

  const pathRefs = Array.from(new Set(referencedPaths)).filter(Boolean);
  if (tokens.length === 0 && pathRefs.length === 0) return [];

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
        continue;
      }
    }

    if (pathRefs.length > 0) {
      const readRefs = extractTestReadReferences(file.content);
      if (readRefs.some((readRef) => pathRefs.some((pathRef) => referencedPathMatches(readRef, pathRef)))) {
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

function unionArrays(...values) {
  return Array.from(new Set(values.flat().filter(Boolean)));
}

function isTestPath(relativePath) {
  return /(^|\/)(__tests__|tests)\//.test(relativePath) || /\.test\.|\.spec\.|_test\.go$/.test(relativePath);
}

function extractEvidencePaths(evidenceText) {
  const paths = new Set();
  for (const rawCandidate of collectPathishTokens(evidenceText)) {
    const candidate = rawCandidate.split('\\').join('/');
    if (!candidate.includes('/') || candidate.includes('*') || candidate.includes('?')) {
      continue;
    }
    if (!hasKnownFileExtension(candidate)) {
      continue;
    }
    paths.add(candidate.replace(/^\.\//, ''));
  }
  return Array.from(paths).sort((left, right) => left.localeCompare(right));
}

function evidenceLineHasPassingSummary(evidenceText) {
  const text = String(evidenceText || '');
  if (/\b\d+\s*\/\s*\d+\s+tests?\s+passing\b/i.test(text)) {
    return true;
  }
  if (/\b(?:vitest|jest|npm test|pnpm test|yarn test|bun test)\b.*\b(?:pass(?:ing|ed)?|green|success(?:ful|fully)?)\b/i.test(text)) {
    return true;
  }
  return false;
}

function evidenceSummaryImpliesTests(evidenceText) {
  return /\btests?\b/i.test(String(evidenceText || '')) ||
    /\b(?:vitest|jest|npm test|pnpm test|yarn test|bun test)\b/i.test(String(evidenceText || ''));
}

function evaluateAuthoritativeEvidence(task, fileIndex) {
  const evidenceLines = Array.isArray(task.evidenceLines) ? task.evidenceLines : [];
  if (evidenceLines.length === 0) {
    return {
      active: false,
      passed: false,
      confidence: null,
      referencedPaths: [],
      matchedPaths: [],
      summaryMatches: [],
      summaryImpliesTests: false,
      hasExtractedPaths: false
    };
  }

  const referencedPaths = unionArrays(...evidenceLines.map((line) => extractEvidencePaths(line.text)));
  const matchedPaths = referencedPaths.length > 0 ? findFilesByPathHints(referencedPaths, fileIndex) : [];
  const summaryMatches = evidenceLines
    .filter((line) => evidenceLineHasPassingSummary(line.text))
    .map((line) => line.text);
  const summaryImpliesTests = summaryMatches.some((line) => evidenceSummaryImpliesTests(line));
  const matchedTestPaths = matchedPaths.filter((relativePath) => isTestPath(relativePath));
  const matchedNonTestPaths = matchedPaths.filter((relativePath) => !isTestPath(relativePath));

  if (referencedPaths.length > 0) {
    if (matchedPaths.length === 0) {
      return {
        active: true,
        passed: false,
        confidence: 'low',
        referencedPaths,
        matchedPaths: [],
        summaryMatches: [],
        summaryImpliesTests: false,
        hasExtractedPaths: true,
        reasons: [`evidence file(s) not found: ${referencedPaths.join(', ')}`]
      };
    }

    return {
      active: true,
      passed: true,
      confidence: matchedTestPaths.length > 0 && matchedNonTestPaths.length > 0 ? 'high' : 'medium',
      referencedPaths,
      matchedPaths,
      summaryMatches: [],
      summaryImpliesTests: matchedTestPaths.length > 0,
      hasExtractedPaths: true,
      reasons: []
    };
  }

  if (summaryMatches.length > 0) {
    return {
      active: true,
      passed: true,
      confidence: 'medium',
      referencedPaths: [],
      matchedPaths: [],
      summaryMatches,
      summaryImpliesTests,
      hasExtractedPaths: false,
      reasons: []
    };
  }

  return {
    active: true,
    passed: false,
    confidence: null,
    referencedPaths: [],
    matchedPaths: [],
    summaryMatches: [],
    summaryImpliesTests: false,
    hasExtractedPaths: false,
    reasons: []
  };
}

function applyAuthoritativeEvidence(evidence, authoritativeEvidence, fileIndex) {
  evidence.authoritative = authoritativeEvidence.passed;
  evidence.authoritativeFiles = authoritativeEvidence.matchedPaths;
  evidence.authoritativeSummaries = authoritativeEvidence.summaryMatches;
  evidence.files = unionArrays(evidence.files, authoritativeEvidence.matchedPaths);

  const indexedFiles = new Map(fileIndex.map((file) => [file.relativePath, file]));
  for (const relativePath of authoritativeEvidence.matchedPaths) {
    const file = indexedFiles.get(relativePath);
    if (!file) {
      continue;
    }
    if (file.isTestFile || isTestPath(relativePath)) {
      evidence.test = true;
      evidence.testFiles = unionArrays(evidence.testFiles, [relativePath]);
      continue;
    }
    if (CODE_EXTENSIONS.has(file.ext)) {
      evidence.code = true;
      evidence.codeFiles = unionArrays(evidence.codeFiles, [relativePath]);
      continue;
    }
    evidence.artifact = true;
    evidence.artifactFiles = unionArrays(evidence.artifactFiles, [relativePath]);
  }

  if (authoritativeEvidence.summaryImpliesTests) {
    evidence.test = true;
  }
}

function countStrongEvidenceCategories(taskText, evidence) {
  if (isDocTask(taskText)) {
    return {
      categories: [
        ...(evidence.artifact ? ['artifact'] : []),
        ...(evidence.files.length > 0 ? ['referenced-file'] : []),
        ...(evidence.code ? ['code'] : []),
        ...(evidence.test ? ['test'] : [])
      ]
    };
  }

  const categories = [];
  if (evidence.code) {
    categories.push('code');
  }
  if (evidence.test) {
    categories.push('test');
  }
  if (evidence.files.length > 0 || evidence.symbols.length > 0 || evidence.structuralEvidence === true) {
    categories.push('feature-surface');
  }
  return { categories };
}

function findNegativeImplementationSignals(candidatePaths, fileIndex) {
  if (!Array.isArray(candidatePaths) || candidatePaths.length === 0) {
    return [];
  }

  const indexedFiles = new Map(fileIndex.map((file) => [file.relativePath, file]));
  const negativeSignals = [
    /\bnot implemented\b/i,
    /throw\s+new\s+Error\s*\(\s*['"`][^'"`]*not implemented/i
  ];

  const matches = [];
  for (const relativePath of unionArrays(candidatePaths)) {
    const file = indexedFiles.get(relativePath);
    if (!file || file.isTestFile || !CODE_EXTENSIONS.has(file.ext)) {
      continue;
    }
    if (negativeSignals.some((pattern) => pattern.test(file.content))) {
      matches.push(relativePath);
    }
  }
  return matches.sort((left, right) => left.localeCompare(right));
}

function extractTaskNamespace(taskId) {
  if (!taskId) return null;
  const match = String(taskId).match(/^([a-z][a-z0-9]*)-/);
  return match ? match[1] : null;
}

function isAcceptanceCriteria(taskId) {
  return /ph\d+[_-]st\d+[_-]exit/.test(String(taskId || ''));
}

// Gate: returns { applicable, passed, structuralFiles, reason }.
// For namespaces with a defined structural pattern:
//   1. If no files in fileIndex match the pattern → immediate fail.
//   2. For acceptance-criteria tasks (phN-stN-exit IDs): path match alone is enough.
//   3. For implementation tasks: feature tokens from task text must score ≥ ceil(n/2)
//      against namespace-matched files, preventing vocabulary overlap from generic
//      infrastructure code (io.js, generator/index.js) from serving as evidence.
function checkNamespaceStructuralEvidence(taskId, taskText, fileIndex) {
  const namespace = extractTaskNamespace(taskId);
  if (!namespace || !NAMESPACE_STRUCTURAL_PATTERNS[namespace]) {
    return { applicable: false, passed: true, structuralFiles: [], reason: null };
  }

  const predicate = NAMESPACE_STRUCTURAL_PATTERNS[namespace];
  const namespaceFiles = fileIndex.filter((f) => predicate(f.relativePath));

  if (namespaceFiles.length === 0) {
    return {
      applicable: true,
      passed: false,
      structuralFiles: [],
      reason: `namespace "${namespace}" has no implementation files`,
    };
  }

  const featureTokens = tokenize(taskText)
    .filter((t) => t.length >= 4 && !GENERIC_TASK_TOKENS.has(t) && !t.endsWith('/'))
    .slice(0, 8);

  if (featureTokens.length === 0) {
    return {
      applicable: true,
      passed: true,
      structuralFiles: namespaceFiles.map((f) => f.relativePath),
      reason: null,
    };
  }

  let bestScore = 0;
  for (const nsFile of namespaceFiles) {
    const lowered = nsFile.content.toLowerCase();
    let score = 0;
    for (const token of featureTokens) {
      if (lowered.includes(token)) score++;
    }
    if (score > bestScore) bestScore = score;
  }

  const threshold = Math.max(1, Math.ceil(featureTokens.length / 2));
  if (bestScore >= threshold) {
    return {
      applicable: true,
      passed: true,
      structuralFiles: namespaceFiles.map((f) => f.relativePath),
      reason: null,
    };
  }

  return {
    applicable: true,
    passed: false,
    structuralFiles: namespaceFiles.map((f) => f.relativePath),
    reason: `structural token score ${bestScore}/${threshold} in "${namespace}" files — token overlap insufficient`,
  };
}

function evaluateRule(rule, task, context) {
  if (!rule) {
    return { passed: true, reasons: [], evidence: {}, overrideResult: false };
  }

  if (rule.when) {
    const regexp = new RegExp(rule.when, 'i');
    if (!regexp.test(task.text)) {
      return { passed: true, reasons: [], evidence: {}, overrideResult: false };
    }
  }

  if (rule.whenId) {
    const regexp = new RegExp(rule.whenId, 'i');
    if (!regexp.test(task.id)) {
      return { passed: true, reasons: [], evidence: {}, overrideResult: false };
    }
  }

  if (typeof rule.check === 'function') {
    const custom = rule.check(task, context);
    if (!custom) {
      return { passed: true, reasons: [], evidence: {}, overrideResult: false };
    }
    return {
      passed: custom.passed !== false,
      reasons: Array.isArray(custom.reasons) ? custom.reasons : [],
      evidence: custom.evidence || {},
      overrideResult: rule.overrideResult === true || custom.overrideResult === true
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

  if (rule.type === 'grant-evidence') {
    const evidenceTargets = Array.isArray(rule.evidence) ? rule.evidence : [rule.evidence].filter(Boolean);
    for (const key of evidenceTargets) {
      evidence[key] = true;
    }
    if (Array.isArray(rule.files) && rule.files.length > 0) {
      evidence.files = rule.files;
    }
    if (Array.isArray(rule.symbols) && rule.symbols.length > 0) {
      evidence.symbols = rule.symbols;
    }
    if (Array.isArray(rule.codeFiles) && rule.codeFiles.length > 0) {
      evidence.codeFiles = rule.codeFiles;
      evidence.code = true;
    }
    if (Array.isArray(rule.testFiles) && rule.testFiles.length > 0) {
      evidence.testFiles = rule.testFiles;
      evidence.test = true;
    }
    if (Array.isArray(rule.artifactFiles) && rule.artifactFiles.length > 0) {
      evidence.artifactFiles = rule.artifactFiles;
      evidence.artifact = true;
    }
  }

  return {
    passed: reasons.length === 0,
    reasons,
    evidence,
    overrideResult: rule.overrideResult === true
  };
}

function buildValidationContext(projectRoot, config, plugins) {
  const files = walkFiles(projectRoot);
  const fileIndex = readFileIndex(projectRoot, files, config);
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
  const standaloneFilenames = extractStandaloneFilenames(task.text);
  const symbolHints = extractSymbolHints(task.text);
  const authoritativeEvidence = evaluateAuthoritativeEvidence(task, context.fileIndex);

  const filesFromPaths = findFilesByPathHints(pathHints, context.fileIndex);
  const filesFromSymbols = findFilesBySymbols(symbolHints, context.fileIndex);
  // Combine path hints AND standalone filenames for token exclusion so that tokens
  // derived from any referenced filename (e.g. "roadmap-skill" from
  // "roadmap-skill.config.json") are excluded from code evidence scoring.
  const pathDerivedTokens = extractPathDerivedTokens([...pathHints, ...standaloneFilenames]);
  const filesFromCode = findCodeEvidence(task.text, context.fileIndex, pathDerivedTokens);
  const filesFromWeakPathTokens = findFilesByTaskPathTokens(task.text, context.fileIndex, pathDerivedTokens);
  const weakPathContentTokens = findWeakPathContentSpecificTokens(task.text, context.fileIndex, filesFromWeakPathTokens, pathDerivedTokens);
  const filesFromTests = findTestEvidence(task.text, context.fileIndex, [...pathHints, ...standaloneFilenames]);
  const { files: filesFromArtifacts, heuristicArtifacts } = findArtifactEvidence(task.text, context.fileIndex);

  const structuralCheck = checkNamespaceStructuralEvidence(task.id, task.text, context.fileIndex);

  const evidence = {
    code: filesFromCode.length > 0 || filesFromSymbols.length > 0,
    test: filesFromTests.length > 0,
    artifact: filesFromArtifacts.length > 0,
    files: filesFromPaths,
    symbols: filesFromSymbols,
    codeFiles: filesFromCode,
    weakPathFiles: filesFromWeakPathTokens,
    weakPathContentTokens,
    testFiles: filesFromTests,
    artifactFiles: filesFromArtifacts,
    heuristicArtifacts,
    structuralEvidence: structuralCheck.applicable ? structuralCheck.passed : null,
    structuralFiles: structuralCheck.structuralFiles,
    authoritative: false,
    authoritativeFiles: [],
    authoritativeSummaries: []
  };
  applyAuthoritativeEvidence(evidence, authoritativeEvidence, context.fileIndex);

  const reasons = [];
  if (pathHints.length > 0 && filesFromPaths.length === 0) {
    reasons.push(`missing referenced file(s): ${pathHints.join(', ')}`);
  }
  if (Array.isArray(authoritativeEvidence.reasons) && authoritativeEvidence.reasons.length > 0) {
    reasons.push(...authoritativeEvidence.reasons);
  }
  if (symbolHints.length > 0 && filesFromSymbols.length === 0) {
    reasons.push(`missing symbol(s): ${symbolHints.join(', ')}`);
  }

  // Namespace-structural gate: for known namespaces, token overlap alone is insufficient.
  // The task must have evidence files whose paths match the namespace pattern.
  if (structuralCheck.applicable && !structuralCheck.passed) {
    reasons.push(structuralCheck.reason || `no structural evidence for namespace "${extractTaskNamespace(task.id)}"`);
  }

  const hasEvidence = evidence.code || evidence.test || evidence.artifact || evidence.files.length > 0;
  const hasWeakEvidence = filesFromWeakPathTokens.length > 0;
  if (!hasEvidence && !hasWeakEvidence && !structuralCheck.applicable && !authoritativeEvidence.hasExtractedPaths && !authoritativeEvidence.passed) {
    reasons.push('no code, test, or artifact evidence found');
  } else if (!hasEvidence && !hasWeakEvidence && structuralCheck.applicable && structuralCheck.passed && !authoritativeEvidence.hasExtractedPaths && !authoritativeEvidence.passed) {
    reasons.push('no code, test, or artifact evidence found');
  } else if (!hasEvidence && hasWeakEvidence) {
    if (weakPathContentTokens.length === 0) {
      reasons.push('weak path-only evidence lacks content-specific token match');
    } else {
      reasons.push('weak path-token evidence lacks strong code, test, or artifact evidence');
    }
  }

  const requiresTest = !task.noTest && context.testFrameworks.length > 0 && isCodeTask(task.text) && !isDocTask(task.text);
  const configuredRules = Array.isArray(config.validators) ? config.validators : [];
  const pluginRules = collectPluginContributions(plugins || [], 'registerValidators', context);
  let overrideResult = null;
  let hasRuleGrantedEvidence = false;
  for (const rule of [...configuredRules, ...pluginRules]) {
    const ruleResult = evaluateRule(rule, task, context);
    if (ruleResult.evidence && Object.keys(ruleResult.evidence).length > 0) {
      hasRuleGrantedEvidence = true;
      Object.assign(evidence, mergeRuleEvidence(evidence, ruleResult.evidence));
    }
    if (!ruleResult.passed) {
      reasons.push(...ruleResult.reasons);
    }
    if (ruleResult.overrideResult) {
      overrideResult = ruleResult;
    }
  }

  const hasStrongEvidence = evidence.code || evidence.test || evidence.artifact || evidence.files.length > 0;
  if (hasStrongEvidence) {
    const noEvidenceReason = 'no code, test, or artifact evidence found';
    const idx = reasons.indexOf(noEvidenceReason);
    if (idx >= 0) {
      reasons.splice(idx, 1);
    }
  }

  if (requiresTest && !evidence.test && !authoritativeEvidence.passed) {
    reasons.push('missing test evidence');
  }

  let uniqueReasons = Array.from(new Set(reasons));

  if (overrideResult) {
    uniqueReasons = Array.isArray(overrideResult.reasons) ? Array.from(new Set(overrideResult.reasons)) : [];
  }

  const attempted = hasStrongEvidence || hasWeakEvidence || pathHints.length > 0 || symbolHints.length > 0 || authoritativeEvidence.active;
  const { categories: strongEvidenceCategories } = countStrongEvidenceCategories(task.text, evidence);
  const strongEvidenceCount = strongEvidenceCategories.length;
  const hasDirectReferencePass = filesFromPaths.length > 0 || filesFromSymbols.length > 0;
  const hasArtifactTaskPass = evidence.artifact && (
    isDocTask(task.text) ||
    evidence.heuristicArtifacts.length > 0 ||
    filesFromPaths.some((relativePath) => !CODE_EXTENSIONS.has(path.extname(relativePath).toLowerCase()))
  );
  const hasTrustedRuleEvidencePass = hasRuleGrantedEvidence && uniqueReasons.length === 0;
  const meetsStrongThreshold = !isDocTask(task.text) && strongEvidenceCount >= 2;

  let confidence = 'low';
  if (authoritativeEvidence.passed) {
    confidence = authoritativeEvidence.confidence || 'medium';
  } else if (meetsStrongThreshold) {
    confidence = 'high';
  } else if (strongEvidenceCount === 1 || hasDirectReferencePass || hasArtifactTaskPass || hasTrustedRuleEvidencePass) {
    confidence = 'medium';
  }

  const negativeSignalMatches = findNegativeImplementationSignals(
    unionArrays(
      evidence.codeFiles,
      evidence.files,
      evidence.symbols,
      evidence.weakPathFiles,
      evidence.structuralFiles
    ),
    context.fileIndex
  );
  if (negativeSignalMatches.length > 0) {
    uniqueReasons.push(`negative implementation signal found in matched evidence: ${negativeSignalMatches.join(', ')}`);
    uniqueReasons = Array.from(new Set(uniqueReasons));
  }

  let passed = authoritativeEvidence.passed || hasDirectReferencePass || hasArtifactTaskPass || hasTrustedRuleEvidencePass || meetsStrongThreshold;
  if (task.warningText && passed && !authoritativeEvidence.passed && !meetsStrongThreshold) {
    passed = false;
    uniqueReasons.push(task.warningText);
    uniqueReasons = Array.from(new Set(uniqueReasons));
  }
  if (negativeSignalMatches.length > 0) {
    passed = false;
  }

  const shouldPreserveCheckedTask =
    task.checked &&
    !passed &&
    !authoritativeEvidence.active &&
    pathHints.length === 0 &&
    symbolHints.length === 0 &&
    !hasDirectReferencePass &&
    evidence.structuralEvidence !== false &&
    negativeSignalMatches.length === 0;
  let preservedCheckedState = false;
  if (shouldPreserveCheckedTask) {
    passed = true;
    confidence = 'low';
    uniqueReasons = [];
    preservedCheckedState = true;
  }

  // True when the only passing evidence is artifact/doc files and the task is not a doc task.
  // Used by auditValidation to flag implementation tasks that pass solely via documentation.
  const evidenceIsDocOnly = !evidence.code && !evidence.test && evidence.artifact && !isDocTask(task.text);

  return {
    taskId: task.id,
    passed: overrideResult ? overrideResult.passed !== false : (passed && uniqueReasons.length === 0),
    confidence,
    reasons: uniqueReasons,
    evidence,
    evidenceIsDocOnly,
    requiresTest,
    hasEvidence: hasStrongEvidence || hasWeakEvidence,
    attempted,
    preservedCheckedState
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
  const checkedWithNoStructuralEvidence = [];

  for (const task of tasks) {
    const result = results[task.id];
    if (!result) continue;

    if (task.checked && !result.passed) {
      checkedWithoutEvidence.push({ task, result });
    }

    if (!task.checked && result.passed) {
      readyButUnchecked.push({ task, result });
    }

    if (task.checked && result.passed && result.confidence === 'low') {
      checkedWithWeakEvidence.push({ task, result });
    }

    if (task.checked && result.passed && result.evidenceIsDocOnly) {
      documentationOnlyEvidenceForImplementation.push({ task, result });
    }

    // Checked task that failed specifically because structural evidence is missing.
    if (task.checked && !result.passed && result.evidence.structuralEvidence === false) {
      checkedWithNoStructuralEvidence.push({ task, result });
    }
  }

  return {
    checkedWithoutEvidence,
    readyButUnchecked,
    checkedWithWeakEvidence,
    documentationOnlyEvidenceForImplementation,
    checkedWithNoStructuralEvidence,
  };
}

function applyMinimumConfidence(results, minimumConfidence) {
  const minRank = CONFIDENCE_RANK[minimumConfidence] ?? 0;
  if (minRank === 0) return;
  for (const result of Object.values(results)) {
    if (result.preservedCheckedState) {
      continue;
    }
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
  applyMinimumConfidence,
  extractTaskNamespace,
  isAcceptanceCriteria,
};
