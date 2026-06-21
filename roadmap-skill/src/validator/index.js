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
const GENERATED_OUTPUT_PREFIXES = ['dist-electron/', 'dist/', 'build/', 'out/', '.next/', 'coverage/'];

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
const CHANGE_VERB_PATTERNS = [
  // Spanish — verb and noun forms of pending-work descriptions
  /^(agregar|añadir|implementar|configurar|reemplazar|cambiar|corregir|manejar|manejo|proteger|sanitizar|validar|deshabilitar|mostrar|generar|expandir|reducir|completar|crear|eliminar|migrar|refactorizar|recovery\s+path)\b/i,
  // English
  /^(add|implement|configure|replace|change|fix|handle|protect|sanitize|validate|disable|show|generate|expand|reduce|complete|create|remove|migrate|refactor|recovery\s+path)\b/i,
];

function taskDescribesChange(taskText) {
  const normalized = String(taskText)
    .replace(/^\*\*\[.*?\]\*\*\s*/, '')
    .replace(/^\[.*?\]\s*/, '')
    .trim();
  return CHANGE_VERB_PATTERNS.some((p) => p.test(normalized));
}

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

function isGeneratedOutputPath(relativePath) {
  const normalized = normalizePathForMatch(relativePath);
  return GENERATED_OUTPUT_PREFIXES.some((prefix) => normalized.startsWith(prefix));
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
  const normalized = stripped.replace(/\\/g, '/');
  if (/^~\//.test(normalized)) {
    return normalized;
  }
  return normalized.replace(/^~(?=\/)/, '~');
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

function findFilesBySymbols(symbolHints, fileIndex) {
  const matches = new Set();
  for (const symbol of symbolHints) {
    const regex = new RegExp(`\\b${escapeRegExp(symbol)}\\b`, 'i');
    for (const file of fileIndex) {
      if (file.generatedOutput) continue;
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
    if (file.generatedOutput) continue;
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
    if (file.generatedOutput || !CODE_EXTENSIONS.has(file.ext) || file.isTestFile) {
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
    if (file.generatedOutput || !file.isTestFile) continue;

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

function findVerificationRecipe(task, context) {
  const patterns = [
    /disabled\s*=\s*\{[^}]+\}/i,
    /<(?:dialog|alertdialog)\b[^>]*\bopen\s*=/i,
    /abortcontroller|abortsignal\.timeout/i,
    /router\.push\s*\(/i
  ];
  for (const file of context.fileIndex) {
    if (file.generatedOutput || file.isTestFile || !CODE_EXTENSIONS.has(file.ext)) continue;
    const match = patterns.map((pattern) => pattern.exec(file.content)).find(Boolean);
    if (!match) continue;
    const line = file.content.slice(0, match.index).split(/\r?\n/).length;
    const command = context.config.validation && context.config.validation.recipeCommand
      ? `; run ${String(context.config.validation.recipeCommand).replace('{testFile}', '<test-file>')}`
      : '';
    return `${file.relativePath}:${line} inspect ${match[0].trim()}${command}`;
  }
  return null;
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
    const recipe = findVerificationRecipe(task, context);
    return {
      applicable: false,
      passed: false,
      reasons: [],
      diagnostics: [{
        code: recipe ? 'REQUIRES_HUMAN_EVIDENCE' : 'NO_STATIC_SIGNAL',
        severity: 'warning',
        message: recipe ? 'behavioral task requires explicit human or test evidence' : 'no static implementation signal was found for behavioral task'
      }],
      recipe
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
    recipe: passed ? null : findVerificationRecipe(task, context)
  };
}

function buildValidationContext(projectRoot, config, plugins) {
  const files = walkFiles(projectRoot);
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
    testReportRecords: readTestReportRecords(projectRoot, config.validation)
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
  const {
    paths: pathHints,
    externalPaths,
    lineReferenceHints
  } = extractExplicitPaths(task.text);
  // Paths that are line-reference hints (file.ts:NN) indicate WHERE to implement,
  // not that implementation exists. They are excluded from hasDirectReferencePass.
  const purePathHints = pathHints.filter((p) => !lineReferenceHints.has(p));
  const standaloneFilenames = extractStandaloneFilenames(task.text);
  const symbolHints = extractSymbolHints(task.text);
  const authoritativeEvidence = evaluateAuthoritativeEvidence(task, context.pathHintResolver);
  const deterministicVerification = evaluateDeterministicVerification(task, context);
  const hasExplicitPendingItems = Array.isArray(task.explicitPendingItems) && task.explicitPendingItems.length > 0;

  const filesFromPaths = findFilesByPathHints(pathHints, context.pathHintResolver);
  const filesFromPurePathHints = findFilesByPathHints(purePathHints, context.pathHintResolver);
  const filesFromSymbols = findFilesBySymbols(symbolHints, context.fileIndex);
  // Combine path hints AND standalone filenames for token exclusion so that tokens
  // derived from any referenced filename (e.g. "roadmap-skill" from
  // "roadmap-skill.config.json") are excluded from code evidence scoring.
  const pathDerivedTokens = extractPathDerivedTokens([...pathHints, ...externalPaths, ...standaloneFilenames]);
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
    // Use only pure path hints (not line-reference hints) so that "file.ts:169" style hints
    // — which indicate WHERE to implement — do not contribute to feature-surface scoring.
    files: filesFromPurePathHints,
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
  // Suppress path hint failures when authoritative evidence already confirms the task —
  // a bad path hint (typo, moved file) should not override a passing Evidence line.
  if (pathHints.length > 0 && filesFromPaths.length === 0 && !authoritativeEvidence.passed) {
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

  const requiresTest =
    !task.noTest &&
    context.testFrameworks.length > 0 &&
    isCodeTask(task.text) &&
    !isDocTask(task.text) &&
    !isHttpExpectationTask(task.text) &&
    !(task.verifyLines || []).some((line) => ['contains', 'property', 'endpoints', 'behavior'].includes(parseVerificationFields(line.text).kind));
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

  if (requiresTest && !evidence.test && !authoritativeEvidence.passed && filesFromPurePathHints.length === 0) {
    reasons.push('missing test evidence');
  }

  let uniqueReasons = Array.from(new Set(reasons));

  if (deterministicVerification.passed) {
    uniqueReasons = uniqueReasons.filter((reason) => (
      reason !== 'no code, test, or artifact evidence found' &&
      reason !== 'missing test evidence' &&
      !reason.startsWith('weak path-')
    ));
  }

  if (deterministicVerification.applicable && deterministicVerification.reasons.length > 0) {
    uniqueReasons = Array.from(new Set([...uniqueReasons, ...deterministicVerification.reasons]));
  }

  if (overrideResult) {
    uniqueReasons = Array.isArray(overrideResult.reasons) ? Array.from(new Set(overrideResult.reasons)) : [];
  }

  const hasConcreteReferenceEvidence = filesFromPaths.length > 0 || filesFromSymbols.length > 0;
  const hasConcreteAttemptEvidence =
    authoritativeEvidence.active ||
    hasRuleGrantedEvidence ||
    filesFromTests.length > 0 ||
    hasConcreteReferenceEvidence ||
    (isDocTask(task.text) && filesFromArtifacts.length > 0);
  const attempted = hasConcreteAttemptEvidence;
  const { categories: strongEvidenceCategories } = countStrongEvidenceCategories(task.text, evidence);
  const strongEvidenceCount = strongEvidenceCategories.length;
  // Only pure path hints (not line-reference hints like file.ts:169) count as direct evidence.
  const hasDirectReferencePass = filesFromPurePathHints.length > 0 || filesFromSymbols.length > 0;
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
  } else if (meetsStrongThreshold && evidence.test) {
    // 'high' requires code + test — code + feature-surface alone is 'medium'
    // so that action-verb tasks (path hint exists but no test) stay gated.
    confidence = 'high';
  } else if (meetsStrongThreshold || strongEvidenceCount === 1 || hasDirectReferencePass || hasArtifactTaskPass || hasTrustedRuleEvidencePass) {
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

  // hasDirectReferencePass is intentionally excluded: a path hint in task text indicates
  // WHERE to implement, not that implementation is done. Unchecked tasks need authoritative
  // evidence, artifact evidence, or strong code+test threshold to pass.
  // Already-checked tasks with found path hints are preserved via shouldPreserveCheckedTask.
  const hasHighConfidenceImplementationEvidence = meetsStrongThreshold && evidence.code && evidence.test;
  const hasFreshRepositoryEvidence = hasStrongEvidence || hasWeakEvidence;
  let staleEvidenceDetected = false;
  let staleEvidenceResolved = false;
  // Heuristic proximity remains useful to locate candidates, but is never sufficient to
  // complete an unchecked task. Completion requires human Evidence, a trusted rule, or a
  // typed deterministic verifier.
  let passed = authoritativeEvidence.passed || hasTrustedRuleEvidencePass || deterministicVerification.passed;

  if (!task.checked && !authoritativeEvidence.passed && !hasTrustedRuleEvidencePass && !deterministicVerification.passed && hasHighConfidenceImplementationEvidence) {
    uniqueReasons.push('implementation task requires deterministic Verify metadata or explicit Evidence to be marked complete');
    uniqueReasons = Array.from(new Set(uniqueReasons));
  }

  if (task.warningText && !task.checked && hasFreshRepositoryEvidence && !authoritativeEvidence.passed) {
    staleEvidenceDetected = true;
  }

  if (!passed && !task.checked && hasDirectReferencePass) {
    const locationReason = 'file reference shows implementation location, not confirmed completion';
    if (!uniqueReasons.includes(locationReason)) {
      uniqueReasons.push(locationReason);
    }
  }

  // Historical warnings are only cleared by independent, high-confidence repository evidence.
  if (task.warningText && !task.checked && passed && !authoritativeEvidence.passed) {
    if ((deterministicVerification.passed || hasHighConfidenceImplementationEvidence) && negativeSignalMatches.length === 0 && uniqueReasons.length === 0) {
      staleEvidenceResolved = true;
    } else {
      passed = false;
      if (uniqueReasons.length === 0) {
        uniqueReasons.push('validation failed');
      }
    }
  }
  if (negativeSignalMatches.length > 0) {
    passed = false;
  }

  const extraDiagnostics = [...deterministicVerification.diagnostics];
  if (hasExplicitPendingItems) {
    passed = false;
    extraDiagnostics.push({
      code: 'HAS_EXPLICIT_PENDING',
      severity: 'warning',
      message: `task declares pending item(s): ${task.explicitPendingItems.map((item) => item.text || 'pending').join(', ')}`
    });
  }

  // Unchecked implementation tasks need explicit evidence or high-confidence implementation
  // evidence. Weak token overlap, direct file references, or code-only matches are not enough.
  if (
    !task.checked &&
    passed &&
    isImplementationTask(task.text) &&
    !authoritativeEvidence.passed &&
    !hasTrustedRuleEvidencePass &&
    !deterministicVerification.passed &&
    !hasArtifactTaskPass &&
    !hasHighConfidenceImplementationEvidence
  ) {
    passed = false;
    const implementationReason = 'implementation task requires Evidence line or high-confidence evidence (code + test) to be marked complete';
    if (!uniqueReasons.includes(implementationReason)) {
      uniqueReasons.push(implementationReason);
    }
  }

  // Preserve already-checked tasks when the validator can't confirm implementation but also
  // can't find strong evidence against it. Two cases:
  //   1. No path/symbol hints at all — no machine-readable claims to evaluate.
  //   2. Path hints resolve to existing files but code/test evidence is absent —
  //      file presence is not implementation; don't uncheck on that alone.
  // Symbol hints are NOT preserved: a missing symbol is a concrete falsifiable claim.
  const shouldPreserveCheckedTask =
    task.checked &&
    !passed &&
    !authoritativeEvidence.active &&
    symbolHints.length === 0 &&
    negativeSignalMatches.length === 0 &&
    evidence.structuralEvidence !== false &&
    (hasDirectReferencePass || purePathHints.length === 0);
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

  const finalPassed = overrideResult ? (overrideResult.passed !== false && !hasExplicitPendingItems) : (passed && uniqueReasons.length === 0 && !hasExplicitPendingItems);
  return {
    taskId: task.id,
    passed: finalPassed,
    confidence,
    reasons: uniqueReasons,
    diagnostics: buildDiagnostics(uniqueReasons, { staleEvidence: staleEvidenceDetected, extra: extraDiagnostics }),
    evidence,
    evidenceIsDocOnly,
    requiresTest,
    hasEvidence: hasStrongEvidence || hasWeakEvidence,
    attempted,
    preservedCheckedState,
    staleEvidenceResolved,
    discoveredEvidence: staleEvidenceResolved ? buildDiscoveredEvidenceLine(evidence) : null,
    verificationRecipe: deterministicVerification.recipe,
    generatedTestEvidence: deterministicVerification.generatedTestEvidence || null
  };
}

const BLOCKED_BY_RE = /\bBlocked\s+by:\s*([^\n.]+)/i;

function validateTasks(tasks, context, config, plugins) {
  const result = {};
  for (const task of tasks) {
    result[task.id] = validateTask(task, context, config, plugins);
  }

  // Post-pass: tasks with "Blocked by: id-a, id-b" cannot pass while any listed dependency
  // is still failing. The IDs may appear inline in task.text OR as child bullet lines
  // (parsed by parser into task.blockedByIds).
  for (const task of tasks) {
    const blockedIds = [];
    const m = BLOCKED_BY_RE.exec(task.text);
    if (m) {
      blockedIds.push(...m[1].split(/[\s,]+/).map((s) => s.trim()).filter(Boolean));
    }
    if (Array.isArray(task.blockedByIds) && task.blockedByIds.length > 0) {
      blockedIds.push(...task.blockedByIds);
    }
    if (blockedIds.length === 0) continue;
    const uniqueBlockedIds = Array.from(new Set(blockedIds));
    const failingDeps = uniqueBlockedIds.filter((id) => result[id] && !result[id].passed);
    if (failingDeps.length > 0 && result[task.id] && result[task.id].passed) {
      result[task.id].passed = false;
      result[task.id].reasons = [`blocked by incomplete tasks: ${failingDeps.join(', ')}`];
    }
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
