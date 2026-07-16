'use strict';

const fs = require('fs');
const path = require('path');
const { walkFiles } = require('./io');

const CODE_EXTS = new Set(['.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.py']);
const SKIP_DIRS_RE = /^(test|tests|__tests__|fixtures|examples|scripts|docs|vendor|third_party|migrations)(\/|$)/;

const FUNC_PATTERNS = {
  js: [
    /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_][\w$]*)\s*\(/gm,
    /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_][\w$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|function\b)/gm,
    /^(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_][\w$]*)/gm,
  ],
  py: [
    /^(?:\s*)(?:async\s+)?def\s+([A-Za-z_][\w]*)\s*\(/gm,
    /^(?:\s*)class\s+([A-Za-z_][\w]*)/gm,
  ],
};

const TODO_RE = /(?:\/\/|#|\*)\s*(TODO|FIXME|HACK)\b\s*[:\-]?\s*(.+?)$/gm;

function langOf(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.py') return 'py';
  if (CODE_EXTS.has(ext)) return 'js';
  return null;
}

function baseName(file) {
  return path.basename(file).replace(/\.(?:js|cjs|mjs|ts|tsx|jsx|py)$/i, '');
}

function hasSiblingTest(file, allFiles) {
  const base = baseName(file);
  const dir = path.dirname(file).split(path.sep).join('/');
  const dirPrefix = dir && dir !== '.' ? `${dir}/` : '';
  const candidates = new Set([
    `${dirPrefix}${base}.test.js`, `${dirPrefix}${base}.test.ts`,
    `${dirPrefix}${base}.spec.js`, `${dirPrefix}${base}.spec.ts`,
    `${dirPrefix}__tests__/${base}.js`, `${dirPrefix}__tests__/${base}.ts`,
    `test/${base}.test.js`, `test/${base}.test.ts`,
    `tests/${base}.test.js`, `tests/${base}.test.ts`,
    `${dirPrefix}test_${base}.py`, `${dirPrefix}${base}_test.py`,
    `tests/test_${base}.py`, `test/test_${base}.py`,
  ]);
  return allFiles.some((f) => candidates.has(f.split(path.sep).join('/')));
}

function extractFunctions(content, lang) {
  const out = [];
  const seen = new Set();
  for (const re of FUNC_PATTERNS[lang] || []) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content)) !== null) {
      const name = m[1];
      if (!name || name.length < 3) continue;
      if (seen.has(name)) continue;
      seen.add(name);
      const line = content.slice(0, m.index).split('\n').length;
      out.push({ name, line });
    }
  }
  return out;
}

function extractTodos(content) {
  const out = [];
  TODO_RE.lastIndex = 0;
  let m;
  while ((m = TODO_RE.exec(content)) !== null) {
    let text = m[2].trim().replace(/\*\/\s*$/, '').trim();
    if (!text || text.length < 3) continue;
    if (text.length > 80) text = `${text.slice(0, 77)}...`;
    const line = content.slice(0, m.index).split('\n').length;
    out.push({ text, line });
  }
  return out;
}

function inferTasks(projectRoot, options = {}) {
  const cap = options.cap || 10;
  const allFiles = walkFiles(projectRoot);

  const codeFiles = allFiles.filter((f) => !SKIP_DIRS_RE.test(f) && langOf(f) !== null);

  const p0 = [];
  const p1 = [];

  for (const relFile of codeFiles) {
    const lang = langOf(relFile);
    let content;
    try {
      content = fs.readFileSync(path.join(projectRoot, relFile), 'utf8');
    } catch {
      continue;
    }

    if (!hasSiblingTest(relFile, allFiles)) {
      for (const f of extractFunctions(content, lang)) {
        p0.push({
          text: `Add tests for \`${f.name}\` in ${relFile}:${f.line}`,
          priority: 'P0',
        });
      }
    }

    for (const t of extractTodos(content)) {
      p1.push({
        text: `Address TODO: ${t.text} (${relFile}:${t.line})`,
        priority: 'P1',
      });
    }
  }

  const tasks = [...p0, ...p1].slice(0, cap);

  return {
    codeFileCount: codeFiles.length,
    p0Count: p0.length,
    p1Count: p1.length,
    tasks,
  };
}

module.exports = { inferTasks };
