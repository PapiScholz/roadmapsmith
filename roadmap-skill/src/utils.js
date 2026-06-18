'use strict';

const path = require('path');

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'into', 'is', 'it', 'of', 'on', 'or', 'that',
  'the', 'to', 'with', 'this', 'these', 'those', 'via', 'per', 'task', 'tasks', 'phase', 'priority'
]);

function toPosix(input) {
  return input.split(path.sep).join('/');
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-') || 'task';
}

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[`*_~#>\[\](){}.!?,:;"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  return normalizeText(text)
    .split(' ')
    .filter(Boolean)
    .filter((token) => !STOP_WORDS.has(token));
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }
  return result;
}

function similarityScore(left, right) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let shared = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      shared += 1;
    }
  }

  const union = new Set([...leftTokens, ...rightTokens]);
  return shared / union.size;
}

function ensureTrailingNewline(text) {
  return text.endsWith('\n') ? text : `${text}\n`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseArgv(argv) {
  const flags = {};
  const positionals = [];

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith('-')) {
      positionals.push(current);
      continue;
    }

    if (current.startsWith('--')) {
      const withoutPrefix = current.slice(2);
      const eqIndex = withoutPrefix.indexOf('=');
      let key;
      let value;

      if (eqIndex >= 0) {
        key = withoutPrefix.slice(0, eqIndex);
        value = withoutPrefix.slice(eqIndex + 1);
      } else {
        key = withoutPrefix;
        const next = argv[i + 1];
        if (next && !next.startsWith('-')) {
          value = next;
          i += 1;
        } else {
          value = true;
        }
      }

      if (Object.prototype.hasOwnProperty.call(flags, key)) {
        if (Array.isArray(flags[key])) {
          flags[key].push(value);
        } else {
          flags[key] = [flags[key], value];
        }
      } else {
        flags[key] = value;
      }
      continue;
    }

    const short = current.slice(1);
    flags[short] = true;
  }

  const command = positionals.length > 0 ? positionals[0] : null;
  return {
    command,
    args: positionals.slice(1),
    flags,
    positionals
  };
}

module.exports = {
  escapeRegExp,
  ensureTrailingNewline,
  normalizeText,
  parseArgv,
  similarityScore,
  slugify,
  toPosix,
  tokenize,
  uniqueBy
};
