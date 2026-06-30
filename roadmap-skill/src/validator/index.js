'use strict';

const path = require('path');
const fs = require('fs');
const { walkFiles, detectTestFrameworks } = require('../io');
const { collectPluginContributions } = require('../config');
const { escapeRegExp, tokenize } = require('../utils');

const CONFIDENCE_RANK = { none: -1, low: 0, medium: 1, high: 2 };

const CODE_EXTENSIONS = new Set([
  '.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.py', '.go', '.rs', '.java', '.kt', '.swift', '.rb', '.php', '.cs'
]);
const TRANSLATION_DIR_SEGMENTS = ['locale', 'locales', 'i18n', 'translations'];
const DEFAULT_EXCLUDED_PATH_PREFIXES = ['.claude/', '.agent/', 'roadmap-skill/'];
const GENERATED_OUTPUT_PREFIXES = [
  'dist-electron/', 'dist/', 'build/', 'out/', '.next/', 'coverage/',
  '.open-next/', '.vercel/', '.svelte-kit/', '.parcel-cache/', '.angular/',
  '.expo/', '.serverless/', '.wrangler/', '.tmp/', 'tmp/'
];
const AUXILIARY_HEURISTIC_PATH_SEGMENTS = new Set(['scripts', 'tools', 'tooling', 'demo', 'demos']);

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

// Patterns that indicate the task describes work still to be done, not completed work.
// Regex form catches verb and noun forms ("Manejo") and two-word constructions ("Recovery path")
// that an exact-match Set would miss. When a task matches, code token overlap alone cannot pass
// it — either an Evidence line or high-confidence evidence (code + test) is required.
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

function isGeneratedOutputPath(relativePath) {
  const normalized = normalizePathForMatch(relativePath);
  return GENERATED_OUTPUT_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function splitNormalizedPathSegments(relativePath) {
  return normalizePathForMatch(relativePath).split('/').filter(Boolean);
}

function isAuxiliaryHeuristicPath(relativePath) {
  return splitNormalizedPathSegments(relativePath).some((segment) => AUXILIARY_HEURISTIC_PATH_SEGMENTS.has(segment));
}

function relativePathExplicitlyReferenced(relativePath, options = {}) {
  const normalized = normalizeReferencedPath(relativePath);
  const explicitPaths = Array.isArray(options.explicitPaths) ? options.explicitPaths : [];
  const explicitFilenames = Array.isArray(options.explicitFilenames) ? options.explicitFilenames : [];
  if (explicitPaths.some((entry) => referencedPathMatches(normalized, entry))) {
    return true;
  }

  const baseName = path.basename(normalized);
  return explicitFilenames.some((entry) => normalizeReferencedPath(entry) === baseName);
}

function shouldSkipHeuristicFile(relativePath, options = {}) {
  return isAuxiliaryHeuristicPath(relativePath) && !relativePathExplicitlyReferenced(relativePath, options);
}

function authoredSiblingGroupKey(relativePath) {
  const normalized = normalizePathForMatch(relativePath);
  const ext = path.extname(normalized);
  return ext ? normalized.slice(0, -ext.length) : normalized;
}

function authoredSiblingExtensionRank(relativePath) {
  const ext = path.extname(String(relativePath || '')).toLowerCase();
  switch (ext) {
    case '.ts':
      return 0;
    case '.tsx':
      return 1;
    case '.jsx':
      return 2;
    case '.js':
      return 3;
    case '.mjs':
      return 4;
    case '.cjs':
      return 5;
    case '.py':
      return 6;
    default:
      return 10;
  }
}

function dedupeAuthoredCompiledSiblings(relativePaths, fileIndex) {
  const indexedPaths = new Set(fileIndex.map((file) => file.relativePath));
  const groups = new Map();
  for (const relativePath of Array.from(new Set(relativePaths)).filter(Boolean)) {
    if (!indexedPaths.has(relativePath)) {
      continue;
    }
    const key = authoredSiblingGroupKey(relativePath);
    const group = groups.get(key) || [];
    group.push(relativePath);
    groups.set(key, group);
  }

  const selected = [];
  for (const group of groups.values()) {
    group.sort((left, right) => {
      const rankDelta = authoredSiblingExtensionRank(left) - authoredSiblingExtensionRank(right);
      if (rankDelta !== 0) return rankDelta;
      return left.localeCompare(right);
    });
    selected.push(group[0]);
  }

  return selected.sort((left, right) => left.localeCompare(right));
}

function finalizeHeuristicMatches(relativePaths, fileIndex, limit = 20) {
  return dedupeAuthoredCompiledSiblings(relativePaths, fileIndex).slice(0, limit);
}

function readFileIndex(projectRoot, files, config) {
  const index = [];
  for (const relativePath of files) {
    if (SELF_REFERENTIAL_FILES.has(relativePath)) continue;
    if (isFixturePath(relativePath)) continue;
    if (shouldExcludeByDefaultPath(relativePath, config)) continue;
    if (isGeneratedOutputPath(relativePath)) continue;

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
      generatedOutput: isGeneratedOutputPath(relativePath),
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
  if (isRealFilePath(token)) return true;
  // Preserve the legacy extension-only fallback for standalone path-looking tokens.
  return hasFileExtension(token);
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

function startsWithKnownPathRoot(token) {
  const normalized = String(token || '').replace(/\\/g, '/').toLowerCase();
  return KNOWN_PATH_ROOTS.some((root) => normalized.startsWith(root.toLowerCase()));
}

function isHttpRouteToken(token) {
  const normalized = String(token || '').trim();
  if (!normalized) return false;
  if (/^(GET|POST|PUT|PATCH|DELETE)\s+\/\S+$/i.test(normalized)) {
    return true;
  }
  return /^\/api\//i.test(normalized);
}

function isMimeTypeToken(token) {
  return /^[A-Za-z0-9.+-]+\/[A-Za-z0-9.+-]+$/.test(String(token || '').trim());
}

function looksLikeFormulaToken(token) {
  return /[=×÷]/.test(String(token || '').trim());
}

function isRealFilePath(token) {
  const normalized = String(token || '').trim().replace(/\\/g, '/');
  if (!normalized) return false;
  if (normalized.includes('*') || normalized.includes('?')) return false;
  if (/\s/.test(normalized)) return false;
  if (looksLikeFormulaToken(normalized)) return false;
  if (isHttpRouteToken(normalized)) return false;

  const looksLikePath =
    hasKnownFileExtension(normalized) ||
    startsWithKnownPathRoot(normalized) ||
    /^\.{1,2}\//.test(normalized) ||
    /^\//.test(normalized);
  if (!looksLikePath) return false;

  if (!hasKnownFileExtension(normalized) && !startsWithKnownPathRoot(normalized) && isMimeTypeToken(normalized)) {
    return false;
  }

  if (/^\.{1,2}\/|^\//.test(normalized)) {
    return /[A-Za-z0-9_]/.test(normalized);
  }

  return true;
}

function isAsciiAlphaNumeric(char) {
  if (!char || char.length === 0) return false;
  const code = char.charCodeAt(0);
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isPathTokenCharacter(char, current) {
  if (char === '~') {
    return !current;
  }
  return isAsciiAlphaNumeric(char) || char === '.' || char === '_' || char === '-' || char === '/' || char === '\\' || char === ':';
}

function stripTrailingPathPunctuation(token) {
  let result = String(token || '');
  while (result.length > 0) {
    const lastChar = result[result.length - 1];
    if (
      lastChar !== '.' &&
      lastChar !== ',' &&
      lastChar !== ';' &&
      lastChar !== ':' &&
      lastChar !== '!' &&
      lastChar !== '?' &&
      lastChar !== ')' &&
      lastChar !== ']' &&
      lastChar !== '>' &&
      lastChar !== '`'
    ) {
      break;
    }
    result = result.slice(0, -1);
  }
  return result;
}

function collectPathishTokens(text) {
  const tokens = [];
  let current = '';
  let tokenStart = -1;
  const source = String(text || '');
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (isPathTokenCharacter(char, current)) {
      if (!current) {
        tokenStart = index;
      }
      current += char;
      continue;
    }
    if (current) {
      const value = stripTrailingPathPunctuation(current);
      if (value) {
        tokens.push({
          value,
          start: tokenStart,
          end: tokenStart + value.length
        });
      }
      current = '';
      tokenStart = -1;
    }
  }
  if (current) {
    const value = stripTrailingPathPunctuation(current);
    if (value) {
      tokens.push({
        value,
        start: tokenStart,
        end: tokenStart + value.length
      });
    }
  }
  return tokens;
}

// LINE_REF_RE matches "path/file.ext:NN" or "path/file.ext:NN-MM" — indicates WHERE
// to implement, not that implementation exists. Paths matching this pattern are added
// to lineReferenceHints and excluded from hasDirectReferencePass scoring.
const LINE_REF_RE = /^(.+?):(\d+)(?:-\d+)?$/;

function normalizePathCandidateToken(rawToken) {
  const stripped = stripTrailingPathPunctuation(String(rawToken || '').trim());
  if (!stripped) {
    return '';
  }
  return stripped.replace(/\\/g, '/');
}

function isExternalPathToken(token) {
  return /^~\//.test(String(token || '').trim().replace(/\\/g, '/'));
}

function classifyExplicitPathCandidate(rawToken) {
  const clean = normalizePathCandidateToken(rawToken);
  if (!clean || clean.includes('*') || clean.includes('?')) {
    return null;
  }

  const lineMatch = LINE_REF_RE.exec(clean);
  if (lineMatch) {
    const linePath = normalizePathCandidateToken(lineMatch[1]);
    if (isExternalPathToken(linePath)) {
      return { path: linePath, kind: 'external', isLineReference: true };
    }
    if (isRealFilePath(linePath)) {
      return { path: linePath, kind: 'repo', isLineReference: true };
    }
    return null;
  }

  if (isExternalPathToken(clean)) {
    return { path: clean, kind: 'external', isLineReference: false };
  }

  if (!isRealFilePath(clean)) {
    return null;
  }

  return { path: clean, kind: 'repo', isLineReference: false };
}

function addClassifiedPath(classified, results, externalPaths, lineReferenceHints) {
  if (!classified) return;
  if (classified.kind === 'external') {
    externalPaths.add(classified.path);
  } else {
    results.add(classified.path);
    if (classified.isLineReference) {
      lineReferenceHints.add(classified.path);
    }
  }
}

function findHttpRequestRouteRanges(text) {
  const ranges = [];
  const pattern = /\b(?:GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s`]+)/gi;
  let match = pattern.exec(String(text || ''));
  while (match) {
    const routeToken = match[1];
    const routeStart = match.index + match[0].length - routeToken.length;
    ranges.push({ start: routeStart, end: routeStart + routeToken.length });
    match = pattern.exec(String(text || ''));
  }
  return ranges;
}

function isTokenInsideRanges(token, ranges) {
  return ranges.some((range) => token.start >= range.start && token.end <= range.end);
}

function addPathTokensFromPlainText(text, results, externalPaths, lineReferenceHints) {
  const ignoredRanges = findHttpRequestRouteRanges(text);
  for (const token of collectPathishTokens(text)) {
    if (!token.value.includes('/') && !isExternalPathToken(token.value)) {
      continue;
    }
    if (isTokenInsideRanges(token, ignoredRanges)) {
      continue;
    }
    addClassifiedPath(classifyExplicitPathCandidate(token.value), results, externalPaths, lineReferenceHints);
  }
}

function addPathTokensFromBacktickSpan(text, results, externalPaths, lineReferenceHints) {
  const wholeSpan = classifyExplicitPathCandidate(text);
  if (wholeSpan) {
    addClassifiedPath(wholeSpan, results, externalPaths, lineReferenceHints);
    return;
  }

  if (!/[;,]/.test(text)) {
    return;
  }

  for (const part of text.split(/[;,]/)) {
    addClassifiedPath(classifyExplicitPathCandidate(part), results, externalPaths, lineReferenceHints);
  }
}

function extractExplicitPaths(text) {
  const results = new Set();
  const externalPaths = new Set();
  const lineReferenceHints = new Set();
  const source = String(text || '');
  let cursor = 0;

  while (cursor < source.length) {
    const openTick = source.indexOf('`', cursor);
    if (openTick < 0) {
      addPathTokensFromPlainText(source.slice(cursor), results, externalPaths, lineReferenceHints);
      break;
    }

    addPathTokensFromPlainText(source.slice(cursor, openTick), results, externalPaths, lineReferenceHints);
    const closeTick = source.indexOf('`', openTick + 1);
    if (closeTick < 0) {
      addPathTokensFromPlainText(source.slice(openTick), results, externalPaths, lineReferenceHints);
      break;
    }

    addPathTokensFromBacktickSpan(source.slice(openTick + 1, closeTick), results, externalPaths, lineReferenceHints);
    cursor = closeTick + 1;
  }

  const paths = Array.from(results)
    .filter((p) => !p.includes('*') && !p.includes('?'))
    .sort((left, right) => left.localeCompare(right));
  return {
    paths,
    externalPaths: Array.from(externalPaths).sort((left, right) => left.localeCompare(right)),
    lineReferenceHints
  };
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

function isHttpExpectationTask(taskText) {
  const text = String(taskText || '');
  if (!/(?:->|→)/.test(text) || !/\bHTTP\s+\d{3}\b/i.test(text)) {
    return false;
  }
  return /\b(?:GET|POST|PUT|PATCH|DELETE)\b/i.test(text) || /\/api\//i.test(text);
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

function isImplementationTask(taskText) {
  return !isDocTask(taskText) && (isCodeTask(taskText) || taskDescribesChange(taskText));
}

function deriveNextAppRouteAlias(relativePath) {
  const normalized = normalizePathForMatch(relativePath);
  const match = normalized.match(/^(?:src\/)?app(?:\/(.*))?\/(page|route)\.(?:js|jsx|ts|tsx)$/);
  if (!match) {
    return null;
  }

  const routePath = match[1] || '';
  const segments = routePath ? routePath.split('/').filter(Boolean) : [];
  const visibleSegments = [];
  for (const segment of segments) {
    if (/^\([^)]*\)$/.test(segment)) {
      continue;
    }
    if (segment.includes('(') || segment.includes(')') || segment.includes('[') || segment.includes(']') || segment.startsWith('@')) {
      return null;
    }
    visibleSegments.push(segment);
  }

  return visibleSegments.length > 0 ? `/${visibleSegments.join('/')}` : '/';
}

function buildPathHintResolver(fileIndex) {
  const routeAliasIndex = new Map();
  for (const file of fileIndex) {
    const alias = deriveNextAppRouteAlias(file.relativePath);
    if (!alias) {
      continue;
    }
    const existing = routeAliasIndex.get(alias) || [];
    existing.push(file.relativePath);
    routeAliasIndex.set(alias, existing);
  }

  for (const [alias, matches] of routeAliasIndex.entries()) {
    routeAliasIndex.set(alias, Array.from(new Set(matches)).sort((left, right) => left.localeCompare(right)));
  }

  return {
    fileIndex,
    routeAliasIndex
  };
}

function findFilesByPathHints(pathHints, pathHintResolver) {
  const resolver = Array.isArray(pathHintResolver)
    ? buildPathHintResolver(pathHintResolver)
    : pathHintResolver;
  const fileIndex = resolver.fileIndex;
  const matches = [];
  for (const hint of pathHints) {
    const normalizedHint = normalizePathCandidateToken(hint);
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

    const routeMatches = resolver.routeAliasIndex.get(normalizedHint);
    if (routeMatches && routeMatches.length > 0) {
      matches.push(...routeMatches);
    }
  }
  return Array.from(new Set(matches)).sort((left, right) => left.localeCompare(right));
}

function findFilesBySymbols(symbolHints, fileIndex, heuristicOptions = {}) {
  const matches = new Set();
  for (const symbol of symbolHints) {
    const regex = new RegExp(`\\b${escapeRegExp(symbol)}\\b`, 'i');
    for (const file of fileIndex) {
      if (file.generatedOutput) continue;
      if (!CODE_EXTENSIONS.has(file.ext)) {
        continue;
      }
      if (shouldSkipHeuristicFile(file.relativePath, heuristicOptions)) {
        continue;
      }
      if (regex.test(file.content)) {
        matches.add(file.relativePath);
      }
    }
  }
  return finalizeHeuristicMatches(Array.from(matches), fileIndex);
}

function findFilesByTaskPathTokens(taskText, fileIndex, pathDerivedTokens = new Set(), heuristicOptions = {}) {
  const tokens = tokenize(taskText)
    .filter((token) => token.length >= 6 && !GENERIC_TASK_TOKENS.has(token) && !pathDerivedTokens.has(token))
    .slice(0, 10);
  if (tokens.length === 0) return [];

  const matches = new Set();
  for (const file of fileIndex) {
    if (file.generatedOutput) continue;
    if (shouldSkipHeuristicFile(file.relativePath, heuristicOptions)) {
      continue;
    }
    const pathSegments = normalizePathForMatch(file.relativePath).split('/').filter(Boolean);
    for (const token of tokens) {
      if (pathSegments.some((segment) => segment === token || segment.includes(token))) {
        matches.add(file.relativePath);
        break;
      }
    }
    if (matches.size >= 20) break;
  }
  return finalizeHeuristicMatches(Array.from(matches), fileIndex);
}

function extractTaskEvidenceTokens(taskText, pathDerivedTokens = new Set(), minimumLength = 3) {
  return tokenize(taskText)
    .filter((token) => token.length >= minimumLength && !GENERIC_TASK_TOKENS.has(token) && !token.endsWith('/') && !pathDerivedTokens.has(token))
    .slice(0, 8);
}

function findWeakPathContentSpecificTokens(taskText, fileIndex, weakPathFiles, pathDerivedTokens = new Set(), heuristicOptions = {}) {
  const tokens = extractTaskEvidenceTokens(taskText, pathDerivedTokens);
  if (tokens.length === 0 || weakPathFiles.length === 0) return [];

  const weakFiles = new Set(weakPathFiles);
  const matches = new Set();
  for (const file of fileIndex) {
    if (!weakFiles.has(file.relativePath) || !CODE_EXTENSIONS.has(file.ext) || file.isTestFile) {
      continue;
    }
    if (shouldSkipHeuristicFile(file.relativePath, heuristicOptions)) {
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

function findCodeEvidence(taskText, fileIndex, pathDerivedTokens = new Set(), heuristicOptions = {}) {
  const tokens = extractTaskEvidenceTokens(taskText, pathDerivedTokens);
  if (tokens.length === 0) {
    return [];
  }

  const matches = [];
  for (const file of fileIndex) {
    if (file.generatedOutput || !CODE_EXTENSIONS.has(file.ext) || file.isTestFile) {
      continue;
    }
    if (shouldSkipHeuristicFile(file.relativePath, heuristicOptions)) {
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

  return finalizeHeuristicMatches(matches, fileIndex);
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

function findTestEvidence(taskText, fileIndex, referencedPaths = [], heuristicOptions = {}) {
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
    if (file.generatedOutput || !file.isTestFile) continue;
    if (shouldSkipHeuristicFile(file.relativePath, heuristicOptions)) {
      continue;
    }

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

  return finalizeHeuristicMatches(matches, fileIndex);
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
    if (file.generatedOutput) continue;
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

function extractReferencedPaths(text) {
  const extracted = extractExplicitPaths(text);
  return {
    repoPaths: extracted.paths,
    externalPaths: extracted.externalPaths
  };
}

function evidenceLineHasPassingSummary(evidenceText) {
  const text = String(evidenceText || '');
  if (/\b\d+(?:\s*\/\s*\d+)?\s+tests?\s+passing\b/i.test(text)) {
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

function evaluateAuthoritativeEvidence(task, pathHintResolver) {
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

  const extractedReferences = evidenceLines.map((line) => extractReferencedPaths(line.text));
  const referencedPaths = unionArrays(...extractedReferences.map((entry) => entry.repoPaths));
  const matchedPaths = referencedPaths.length > 0 ? findFilesByPathHints(referencedPaths, pathHintResolver) : [];
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

function parseVerificationFields(text) {
  const fields = {};
  for (const part of String(text || '').split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) continue;
    const key = part.slice(0, separator).trim().toLowerCase();
    let value = part.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && value) fields[key] = value;
  }
  return fields;
}

function stripCodeComments(content) {
  const source = String(content || '');
  let result = '';
  let quote = null;
  let escaped = false;
  let lineHasContent = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (quote) {
      result += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      if (char === '\n') lineHasContent = false;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      result += char;
      lineHasContent = true;
      continue;
    }

    if (char === '/' && next === '*') {
      const closeIndex = source.indexOf('*/', index + 2);
      index = closeIndex < 0 ? source.length : closeIndex + 1;
      continue;
    }

    if (char === '/' && next === '/') {
      const newlineIndex = source.indexOf('\n', index + 2);
      if (newlineIndex < 0) break;
      result += '\n';
      lineHasContent = false;
      index = newlineIndex;
      continue;
    }

    if (char === '#' && !lineHasContent) {
      const newlineIndex = source.indexOf('\n', index + 1);
      if (newlineIndex < 0) break;
      result += '\n';
      lineHasContent = false;
      index = newlineIndex;
      continue;
    }

    result += char;
    if (char === '\n') {
      lineHasContent = false;
    } else if (!/\s/.test(char)) {
      lineHasContent = true;
    }
  }

  return result;
}

function findIndexedFile(relativePath, context) {
  const normalized = normalizeReferencedPath(relativePath);
  return context.fileIndex.find((file) => !file.generatedOutput && (
    normalizeReferencedPath(file.relativePath) === normalized ||
    normalizeReferencedPath(file.relativePath).endsWith('/' + normalized)
  ));
}

function readTestReportRecords(projectRoot, validationConfig) {
  const reports = Array.isArray(validationConfig && validationConfig.testReports)
    ? validationConfig.testReports
    : [];
  const records = [];

  function visit(value, reportPath, mtimeMs) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((entry) => visit(entry, reportPath, mtimeMs));
      return;
    }
    const status = String(value.status || value.state || value.result || '').toLowerCase();
    const file = value.file || value.filepath || value.testFile || value.nameFile;
    const name = value.fullName || value.fullname || value.name || value.title;
    if (file && name && /^(pass|passed|success)$/.test(status)) {
      records.push({ file: String(file), name: String(name), reportPath, mtimeMs });
    }
    Object.values(value).forEach((entry) => visit(entry, reportPath, mtimeMs));
  }

  for (const report of reports) {
    if (!report || report.format !== 'vitest-json' || !report.path) continue;
    const reportPath = path.resolve(projectRoot, report.path);
    try {
      const payload = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      const mtimeMs = fs.statSync(reportPath).mtimeMs;
      visit(payload, reportPath, mtimeMs);
    } catch {
      // A missing or malformed optional report is simply unavailable evidence.
    }
  }
  return records;
}

function timestampIsFresh(timestamp, files) {
  const verifiedAt = Date.parse(timestamp || '');
  if (!Number.isFinite(verifiedAt)) return false;
  return files.every((file) => {
    try {
      return verifiedAt >= fs.statSync(file.absolutePath).mtimeMs;
    } catch {
      return false;
    }
  });
}

function findFreshTestProof(task, fields, context) {
  const testFile = findIndexedFile(fields.test || fields.file, context);
  const sourceFile = fields.source ? findIndexedFile(fields.source, context) : null;
  const caseName = fields.case;
  if (!testFile || !caseName) return { passed: false, available: false };
  const freshnessFiles = [testFile, ...(sourceFile ? [sourceFile] : [])];
  const evidenceLines = Array.isArray(task.testEvidenceLines) ? task.testEvidenceLines : [];
  for (const line of evidenceLines) {
    const evidence = parseVerificationFields(line.text);
    if (String(evidence.status || '').toUpperCase() !== 'PASS') continue;
    if (normalizeReferencedPath(evidence.file) !== normalizeReferencedPath(testFile.relativePath)) continue;
    if (evidence.case !== caseName) continue;
    if (timestampIsFresh(evidence.verifiedat, freshnessFiles)) {
      return { passed: true, available: true };
    }
    return { passed: false, available: true, stale: true };
  }
  for (const record of context.testReportRecords || []) {
    if (!referencedPathMatches(record.file, testFile.relativePath) || !record.name.includes(caseName)) continue;
    if (record.mtimeMs >= Math.max(...freshnessFiles.map((file) => fs.statSync(file.absolutePath).mtimeMs))) {
      return {
        passed: true,
        available: true,
        generatedEvidence: `file=${testFile.relativePath}; case=${caseName}; status=PASS; verifiedAt=${new Date(record.mtimeMs).toISOString()}`
      };
    }
    return { passed: false, available: true, stale: true };
  }
  return { passed: false, available: false };
}

function testCoversEndpoint(testFile, route, context) {
  const normalizedRoute = String(route).replace(/\[([^\]]+)\]/g, '$1').toLowerCase();
  const normalizedContent = testFile.content.replace(/\[([^\]]+)\]/g, '$1').toLowerCase();
  if (normalizedContent.includes(normalizedRoute)) return true;
  const source = findIndexedFile(`src/app${route}/route.ts`, context);
  if (source && normalizedContent.includes(path.basename(source.relativePath, source.ext).toLowerCase())) return true;
  const segments = normalizedRoute.split('/').filter((segment) => segment.length >= 3);
  return segments.length > 0 && segments.every((segment) => normalizedContent.includes(segment));
}

function extractPathDomainTokens(relativePath) {
  return splitNormalizedPathSegments(relativePath)
    .flatMap((segment) => tokenize(segment))
    .filter((token) => token.length >= 2 && !GENERIC_TASK_TOKENS.has(token));
}

function collectRecipeLineContext(content, index) {
  const source = String(content || '');
  const lineStart = source.lastIndexOf('\n', index);
  const lineEnd = source.indexOf('\n', index);
  const previousLineStart = lineStart > 0 ? source.lastIndexOf('\n', lineStart - 1) : -1;
  const start = previousLineStart >= 0 ? previousLineStart + 1 : 0;
  const end = lineEnd >= 0 ? lineEnd : source.length;
  return source.slice(start, end);
}

function appendUniqueDiagnostic(diagnostics, diagnostic) {
  if (!diagnostic || !diagnostic.code) {
    return diagnostics;
  }
  if (diagnostics.some((item) => item.code === diagnostic.code)) {
    return diagnostics;
  }
  diagnostics.push(diagnostic);
  return diagnostics;
}

function buildTaskRecipeCandidatePool(task, context) {
  const { paths: pathHints, externalPaths } = extractExplicitPaths(task.text);
  const standaloneFilenames = extractStandaloneFilenames(task.text);
  const symbolHints = extractSymbolHints(task.text);
  const pathDerivedTokens = extractPathDerivedTokens([...pathHints, ...externalPaths, ...standaloneFilenames]);
  const heuristicOptions = {
    explicitPaths: [...pathHints, ...externalPaths],
    explicitFilenames: standaloneFilenames
  };
  const candidatePaths = unionArrays(
    findFilesByPathHints(pathHints, context.pathHintResolver),
    findFilesBySymbols(symbolHints, context.fileIndex, heuristicOptions),
    findCodeEvidence(task.text, context.fileIndex, pathDerivedTokens, heuristicOptions),
    findFilesByTaskPathTokens(task.text, context.fileIndex, pathDerivedTokens, heuristicOptions)
  );
  const indexedFiles = new Map(context.fileIndex.map((file) => [file.relativePath, file]));
  return candidatePaths.map((relativePath) => indexedFiles.get(relativePath)).filter(Boolean);
}

function findVerificationRecipe(task, context) {
  if ((Array.isArray(task.verifyLines) && task.verifyLines.length > 0) || (Array.isArray(task.evidenceLines) && task.evidenceLines.length > 0)) {
    return { recipe: null, specificityFailure: false, foundStaticSignal: false };
  }

  const patterns = [
    /disabled\s*=\s*\{[^}]+\}/i,
    /<(?:dialog|alertdialog)\b[^>]*\bopen\s*=/i,
    /abortcontroller|abortsignal\.timeout/i,
    /router\.push\s*\(/i
  ];
  const taskTokens = extractTaskEvidenceTokens(task.text, new Set(), 2);
  const candidateFiles = buildTaskRecipeCandidatePool(task, context);
  const candidates = [];
  let foundStaticSignal = false;

  for (const file of candidateFiles) {
    if (file.generatedOutput || file.isTestFile || !CODE_EXTENSIONS.has(file.ext)) continue;
    for (const pattern of patterns) {
      const match = pattern.exec(file.content);
      if (!match) {
        continue;
      }
      foundStaticSignal = true;
      const pathTokens = extractPathDomainTokens(file.relativePath);
      if (!pathTokens.some((token) => taskTokens.includes(token))) {
        continue;
      }
      const lineContext = collectRecipeLineContext(file.content, match.index);
      const contextTokens = extractTaskEvidenceTokens(`${match[0]} ${lineContext}`, new Set(), 2);
      if (!contextTokens.some((token) => taskTokens.includes(token))) {
        continue;
      }
      const line = file.content.slice(0, match.index).split(/\r?\n/).length;
      const command = context.config.validation && context.config.validation.recipeCommand
        ? `; run ${String(context.config.validation.recipeCommand).replace('{testFile}', '<test-file>')}`
        : '';
      candidates.push(`${file.relativePath}:${line} inspect ${match[0].trim()}${command}`);
      break;
    }
  }

  const uniqueCandidates = Array.from(new Set(candidates));
  if (uniqueCandidates.length === 1) {
    return { recipe: uniqueCandidates[0], specificityFailure: false, foundStaticSignal };
  }

  return {
    recipe: null,
    specificityFailure: foundStaticSignal || candidates.length > 0,
    foundStaticSignal
  };
}

function isBehavioralTask(taskText) {
  return /\b(mostrar|deshabilitar|confirmar|notificar|redirigir|imprimir|show|disable|confirm|notify|redirect|print)\b/i.test(String(taskText || ''));
}

function evaluateDeterministicVerification(task, context) {
  const verifyLines = Array.isArray(task.verifyLines) ? task.verifyLines : [];
  if (verifyLines.length === 0) {
    if (!isBehavioralTask(task.text)) {
      return { applicable: false, passed: false, reasons: [], diagnostics: [], recipe: null };
    }
    const recipeResult = findVerificationRecipe(task, context);
    const diagnostics = [];
    if (recipeResult.specificityFailure) {
      diagnostics.push({
        code: 'REQUIRES_HUMAN_EVIDENCE',
        severity: 'warning',
        message: 'behavioral task requires explicit human or test evidence'
      });
      diagnostics.push({
        code: 'NO_SPECIFIC_RECIPE',
        severity: 'warning',
        message: 'no task-specific verification recipe could be generated'
      });
    } else {
      diagnostics.push({
        code: recipeResult.recipe ? 'REQUIRES_HUMAN_EVIDENCE' : 'NO_STATIC_SIGNAL',
        severity: 'warning',
        message: recipeResult.recipe ? 'behavioral task requires explicit human or test evidence' : 'no static implementation signal was found for behavioral task'
      });
    }
    return {
      applicable: false,
      passed: false,
      reasons: [],
      diagnostics,
      recipe: recipeResult.recipe
    };
  }
  const reasons = [];
  const diagnostics = [];
  let generatedTestEvidence = null;

  for (const line of verifyLines) {
    const fields = parseVerificationFields(line.text);
    const kind = fields.kind;
    if (kind === 'contains' || kind === 'property') {
      const file = findIndexedFile(fields.file, context);
      if (!file) {
        reasons.push(`missing referenced file(s): ${fields.file || '<unspecified>'}`);
        continue;
      }
      const content = stripCodeComments(file.content);
      if (kind === 'contains') {
        if (!fields.expected || !content.includes(fields.expected)) {
          reasons.push(`no content match in ${file.relativePath}: expected ${fields.expected || '<unspecified>'}`);
        }
        continue;
      }
      const keyPattern = new RegExp(`\\b${escapeRegExp(fields.key || '')}\\s*:`);
      const exactPattern = new RegExp(`\\b${escapeRegExp(fields.key || '')}\\s*:\\s*${escapeRegExp(fields.equals || '')}(?=\\s*[,}\\n])`);
      if (!exactPattern.test(content)) {
        reasons.push(keyPattern.test(content)
          ? `wrong value for ${fields.key} in ${file.relativePath}: expected ${fields.equals}`
          : `no content match in ${file.relativePath}: expected ${fields.key}: ${fields.equals}`);
      }
      continue;
    }
    if (kind === 'endpoints') {
      const routes = String(fields.routes || '').split(',').map((value) => value.trim()).filter(Boolean);
      const tests = context.fileIndex.filter((file) => !file.generatedOutput && file.isTestFile);
      const covered = routes.filter((route) => tests.some((file) => testCoversEndpoint(file, route, context)));
      if (covered.length !== routes.length) {
        const missing = routes.filter((route) => !covered.includes(route));
        reasons.push(`partial endpoint coverage ${covered.length}/${routes.length}: missing ${missing.join(', ')}`);
      }
      continue;
    }
    if (kind === 'behavior') {
      const source = findIndexedFile(fields.source, context);
      const testFile = findIndexedFile(fields.test, context);
      const testContent = testFile ? testFile.content : '';
      const sourceReference = source && testContent.includes(path.basename(source.relativePath, source.ext));
      const exercise = fields.trigger && testContent.includes(fields.trigger);
      const assertion = fields.assertion && testContent.includes(fields.assertion);
      const namedCase = fields.case && testContent.includes(fields.case);
      const proof = findFreshTestProof(task, fields, context);
      if (!source || !testFile || !sourceReference || !exercise || !assertion || !namedCase) {
        diagnostics.push({ code: 'REQUIRES_HUMAN_EVIDENCE', severity: 'warning', message: 'behavior verification needs a source reference, named test, trigger, and assertion' });
        continue;
      }
      if (proof.stale) {
        diagnostics.push({ code: 'STALE_TEST_REPORT', severity: 'warning', message: `test result for ${testFile.relativePath} predates the verified source` });
        continue;
      }
      if (!proof.passed) {
        diagnostics.push({ code: 'REQUIRES_HUMAN_EVIDENCE', severity: 'warning', message: `no fresh passing result for ${testFile.relativePath}` });
        continue;
      }
      generatedTestEvidence = proof.generatedEvidence || generatedTestEvidence;
      continue;
    }
    reasons.push(`unsupported verification kind: ${kind || '<unspecified>'}`);
  }

  const passed = reasons.length === 0 && diagnostics.length === 0;
  return {
    applicable: true,
    passed,
    reasons,
    diagnostics,
    generatedTestEvidence,
    recipe: null
  };
}

function buildValidationContext(projectRoot, config, plugins, options = {}) {
  const userExcludeDirs = Array.isArray(config && config.scan && config.scan.excludeDirs)
    ? config.scan.excludeDirs
    : [];
  const files = walkFiles(projectRoot, { extraIgnoredDirs: userExcludeDirs });
  const fileIndex = readFileIndex(projectRoot, files, config);
  const testFrameworks = detectTestFrameworks(projectRoot, files);
  const pathHintResolver = buildPathHintResolver(fileIndex);

  return {
    projectRoot,
    config,
    plugins,
    files,
    fileIndex,
    pathHintResolver,
    testFrameworks,
    testReportRecords: readTestReportRecords(projectRoot, config.validation),
    strictValidation: options.strictValidation === true
  };
}

function diagnosticCodeForReason(reason) {
  const normalized = String(reason || '').toLowerCase();
  if (normalized.includes('missing referenced file') || normalized.includes('evidence file(s) not found')) {
    return 'MISSING_REFERENCE';
  }
  if (normalized.includes('missing test evidence')) {
    return 'NO_TEST';
  }
  if (normalized.includes('wrong value')) {
    return 'WRONG_VALUE';
  }
  if (normalized.includes('partial endpoint coverage')) {
    return 'PARTIAL';
  }
  if (normalized.includes('no content match')) {
    return 'NOT_IMPLEMENTED';
  }
  if (
    normalized.includes('no code, test, or artifact evidence found') ||
    normalized.includes('implementation task requires evidence line') ||
    normalized.includes('weak path') ||
    normalized.includes('file reference shows implementation location')
  ) {
    return 'NOT_IMPLEMENTED';
  }
  return null;
}

function buildDiagnostics(reasons, options = {}) {
  const diagnostics = [];
  const seen = new Set();
  for (const reason of Array.isArray(reasons) ? reasons : []) {
    const code = diagnosticCodeForReason(reason);
    if (!code || seen.has(code)) {
      continue;
    }
    seen.add(code);
    diagnostics.push({ code, severity: 'error', message: reason });
  }
  if (options.staleEvidence) {
    diagnostics.push({
      code: 'STALE_EVIDENCE',
      severity: 'warning',
      message: 'historical validation warning conflicts with fresh repository evidence'
    });
  }
  for (const diagnostic of options.extra || []) {
    if (!diagnostic || !diagnostic.code || diagnostics.some((item) => item.code === diagnostic.code)) continue;
    diagnostics.push(diagnostic);
  }
  return diagnostics;
}

function buildDiscoveredEvidenceLine(evidence) {
  const files = unionArrays(evidence.codeFiles, evidence.testFiles)
    .sort((left, right) => left.localeCompare(right));
  return files.length > 0 ? files.join(', ') : null;
}

function validateTask(task, context, config, plugins) {
  const fileIndex = Array.isArray(context) ? context : (context && context.fileIndex) || [];
  const pathHintResolver = Array.isArray(context)
    ? buildPathHintResolver(fileIndex)
    : (context && context.pathHintResolver) || buildPathHintResolver(fileIndex);
  const strictValidation = !Array.isArray(context) && context && context.strictValidation === true;
  const taskId = task.id || task.text || '';

  // rs:planned bypass
  if (task.planned || task.plannedMarker || (task.markers && task.markers.includes('rs:planned'))) {
    return {
      taskId, passed: false, planned: true, confidence: 'none', reasons: [], diagnostics: [],
      evidence: { code: false, test: false, artifact: false, files: [], codeFiles: [], testFiles: [], symbols: [], structuralEvidence: null },
      attempted: false, preservedCheckedState: false, requiresTest: false,
      staleEvidenceDetected: false, staleEvidenceResolved: false, discoveredEvidence: null, verificationRecipe: null, generatedTestEvidence: null
    };
  }

  const { paths: pathHints, externalPaths, lineReferenceHints } = extractExplicitPaths(task.text || '');
  const purePathHints = pathHints.filter((p) => !lineReferenceHints.has(p));
  const symbolHints = extractSymbolHints(task.text || '');
  const reasons = [];

  // Evidence lines: explicit user declarations (- Evidence: file.ts under the task)
  const evidenceLines = task.evidenceLines || [];
  let evidenceLinePass = false;
  for (const eLine of evidenceLines) {
    if (!eLine || !eLine.text) continue;
    for (const eText of eLine.text.split(',').map((s) => s.trim()).filter(Boolean)) {
      const eFound = findFilesByPathHints([eText], pathHintResolver);
      if (eFound.length > 0) {
        evidenceLinePass = true;
      } else if (eText.includes('/') || /\.\w+$/.test(eText)) {
        reasons.push('missing referenced file(s): ' + eText);
      }
    }
  }

  // Pass 1: explicit path match (from task text)
  const pass1Files = findFilesByPathHints(purePathHints, pathHintResolver);
  const pass1Found = pass1Files.length > 0;

  // Missing referenced file check (for text-based path hints)
  const allResolvedPaths = findFilesByPathHints(pathHints, pathHintResolver);
  if (pathHints.length > 0 && allResolvedPaths.length === 0) {
    const internalHints = pathHints.filter((h) => !(externalPaths || []).includes(h));
    if (internalHints.length > 0) {
      reasons.push('missing referenced file(s): ' + internalHints.join(', '));
    }
  }

  // Path hint found: unchecked adds location reason; checked sets preservedCheckedState
  let preservedCheckedState = false;
  if (pass1Found) {
    if (task.checked) {
      preservedCheckedState = true;
    } else {
      reasons.push('file reference shows implementation location, not confirmed completion');
    }
  }

  // Pass 2: symbol match in non-test code files
  const pass2Files = findFilesBySymbols(symbolHints, fileIndex, {});
  const pass2 = pass2Files.length > 0;

  // Pass 3: test file import match
  const taskTokens = tokenize(task.text || '').filter((t) => t.length >= 3 && !GENERIC_TASK_TOKENS.has(t));
  const pass3Files = [];
  if (taskTokens.length > 0) {
    for (const file of fileIndex) {
      if (!file.isTestFile) continue;
      const importRefs = (
        file.content.match(/require\s*\(\s*['"\`]([^'"\`]+)['"\`]\s*\)|from\s+['"\`]([^'"\`]+)['"\`]/g) || []
      ).join(' ').toLowerCase();
      if (taskTokens.some((t) => importRefs.includes(t.toLowerCase()))) {
        pass3Files.push(file.relativePath);
      }
    }
  }
  const pass3 = pass3Files.length > 0;

  // Namespace structural gate
  let structuralEvidence = null;
  const ns = extractTaskNamespace(taskId);
  if (ns && NAMESPACE_STRUCTURAL_PATTERNS[ns]) {
    const structuralCheck = checkNamespaceStructuralEvidence(taskId, task.text || '', fileIndex);
    if (structuralCheck.applicable) {
      if (!structuralCheck.passed) {
        reasons.push(structuralCheck.reason || `no structural evidence for namespace "${ns}"`);
        return {
          taskId, passed: false, confidence: 'low', reasons, diagnostics: [],
          evidence: { code: false, test: false, artifact: false, files: [], codeFiles: [], testFiles: [], symbols: [], structuralEvidence: false },
          attempted: pass1Found || pass2 || pass3, preservedCheckedState: false, requiresTest: true,
          staleEvidenceDetected: false, staleEvidenceResolved: false, discoveredEvidence: null, verificationRecipe: null, generatedTestEvidence: null
        };
      } else {
        structuralEvidence = true;
      }
    }
  }

  const hasMissingRef = reasons.some((r) => r.startsWith('missing referenced file'));
  const codeOrTestPass = pass2 || pass3;
  const passed = !hasMissingRef && (evidenceLinePass || (!strictValidation && preservedCheckedState) || codeOrTestPass);

  // Checked task with no hard evidence: preserve with low confidence (not in strict mode)
  if (task.checked && !passed && !hasMissingRef && !strictValidation) {
    return {
      taskId, passed: true, confidence: 'low', reasons: [], diagnostics: [],
      evidence: { code: false, test: false, artifact: false, files: [], codeFiles: [], testFiles: [], symbols: symbolHints.filter((s) => !GENERIC_TASK_TOKENS.has(s.toLowerCase())), structuralEvidence: null },
      attempted: false, preservedCheckedState: true, requiresTest: false,
      staleEvidenceDetected: false, staleEvidenceResolved: false, discoveredEvidence: null, verificationRecipe: null, generatedTestEvidence: null
    };
  }

  if (!passed && reasons.length === 0) {
    reasons.push('no implementation evidence found in pass 1 (explicit paths), pass 2 (symbols), or pass 3 (test imports)');
  }

  const passCount = [evidenceLinePass || preservedCheckedState, pass2, pass3].filter(Boolean).length;
  const confidence = passCount >= 2 ? 'high' : passCount === 1 ? 'medium' : 'low';

  return {
    taskId, passed, confidence, reasons, diagnostics: [],
    evidence: {
      code: pass2, test: pass3, artifact: false,
      files: pass1Files, codeFiles: pass2Files, testFiles: pass3Files,
      symbols: symbolHints.filter((s) => !GENERIC_TASK_TOKENS.has(s.toLowerCase())),
      structuralEvidence
    },
    attempted: passCount > 0, preservedCheckedState, requiresTest: true,
    staleEvidenceDetected: false, staleEvidenceResolved: false,
    discoveredEvidence: [...pass1Files, ...pass2Files].slice(0, 3).join(', ') || null,
    verificationRecipe: null, generatedTestEvidence: null
  };
}

const BLOCKED_BY_RE = /\bBlocked\s+by:\s*([^\n.]+)/i;

function validateTasks(tasks, context, config, plugins) {
  config = config || {};
  if (Array.isArray(context)) {
    const fileIndex = context;
    const pathHintResolver = buildPathHintResolver(fileIndex);
    context = { fileIndex, pathHintResolver, config };
  } else if (!context || !context.fileIndex) {
    const projectRoot = typeof context === 'string' ? context : '.';
    const files = walkFiles(projectRoot);
    const fileIndex = readFileIndex(projectRoot, files, config);
    const pathHintResolver = buildPathHintResolver(fileIndex);
    context = { fileIndex, pathHintResolver, config };
  }

  const results = {};
  for (const task of tasks) {
    if (!task || !task.id) continue;
    results[task.id] = validateTask(task, context);
  }

  // blocked-by post-pass (handles parser blockedByIds and inline text)
  for (const task of tasks) {
    if (!task || !task.id) continue;
    const result = results[task.id];
    if (!result || !result.passed) continue;
    const blockedIds = Array.isArray(task.blockedByIds) && task.blockedByIds.length > 0
      ? task.blockedByIds
      : (() => { const m = BLOCKED_BY_RE.exec(task.text || ''); return m ? [m[1].trim()] : []; })();
    for (const depId of blockedIds) {
      const depResult = results[depId];
      if (depResult && !depResult.passed) {
        result.passed = false;
        result.reasons = (result.reasons || []).concat('blocked by incomplete dependency: ' + depId);
        break;
      }
    }
  }

  return results;
}

function auditValidation(tasks, results, changes) {
  const checkedWithoutEvidence = [];
  const readyButUnchecked = [];
  const checkedWithWeakEvidence = [];
  const documentationOnlyEvidenceForImplementation = [];
  const checkedWithNoStructuralEvidence = [];
  const humanVerifiedTasks = [];
  const newlyUnchecked = Array.isArray(changes && changes.newlyUnchecked) ? changes.newlyUnchecked : [];

  for (const task of tasks) {
    const result = results[task.id];
    if (!result) continue;

    if (result.humanVerified) {
      humanVerifiedTasks.push({ task, result });
    }

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
    if (task.checked && !result.passed && result.evidence && result.evidence.structuralEvidence === false) {
      checkedWithNoStructuralEvidence.push({ task, result });
    }
  }

  return {
    checkedWithoutEvidence,
    readyButUnchecked,
    checkedWithWeakEvidence,
    documentationOnlyEvidenceForImplementation,
    checkedWithNoStructuralEvidence,
    humanVerifiedTasks,
    newlyUnchecked
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
