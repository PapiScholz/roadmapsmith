'use strict';

const { tokenize } = require('./utils');

// v0.13.4: filter English filler + generic product words that would otherwise
// dominate any northStar phrase and drown out the real domain vocabulary.
const STOP_WORDS = new Set([
  // articles, prepositions, conjunctions, common short verbs
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'onto', 'over', 'under', 'between', 'through',
  'has', 'had', 'have', 'was', 'were', 'been', 'being', 'are', 'you', 'your', 'our', 'their', 'its', 'not',
  // generic English verbs / actions
  'make', 'makes', 'made', 'ship', 'ships', 'shipped', 'build', 'builds', 'built', 'use', 'uses', 'used',
  'run', 'runs', 'get', 'gets', 'set', 'sets', 'add', 'adds', 'let', 'lets', 'give', 'gives', 'take', 'takes',
  'put', 'puts', 'keep', 'keeps', 'kept', 'want', 'wants', 'need', 'needs', 'help', 'helps', 'work', 'works',
  // determiners / quantifiers
  'all', 'any', 'some', 'every', 'each', 'many', 'much', 'more', 'less', 'few', 'both', 'one', 'two',
  // generic tech / product filler
  'app', 'apps', 'code', 'codes', 'file', 'files', 'tool', 'tools', 'thing', 'things', 'stuff',
  'project', 'projects', 'product', 'products', 'system', 'systems', 'platform', 'platforms',
  'software', 'feature', 'features', 'user', 'users', 'team', 'teams', 'task', 'tasks', 'item', 'items',
  // marketing filler that appears in most one-liners
  'better', 'best', 'good', 'great', 'nice', 'clean', 'simple', 'easy', 'fast', 'small', 'large', 'big',
  'zero', 'living', 'evidence', 'backed', 'manual', 'automatic', 'auto', 'first',
  'maintenance', 'ready', 'production', 'modern', 'new', 'old'
]);

function detectDrift(northStar, scanResult, extraSignals = []) {
  const {
    languages = [],
    testFrameworks = [],
    modules = [],
    commands = [],
    projectType = ''
  } = scanResult || {};

  const signalStrings = [
    ...languages,
    ...testFrameworks,
    ...modules,
    ...commands,
    projectType,
    ...(Array.isArray(extraSignals) ? extraSignals : [])
  ]
    .map((s) => String(s || '').toLowerCase())
    .filter(Boolean);

  const tokens = tokenize(String(northStar || ''))
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));

  if (tokens.length === 0) {
    return { drifted: false, score: 100, summary: 'Aligned (score: 100)', details: [] };
  }

  const details = [];
  let matched = 0;

  for (const token of tokens) {
    const found = signalStrings.some((s) => s.includes(token));
    if (found) {
      matched += 1;
    } else {
      details.push(`northStar mentions '${token}' but not detected in repo`);
    }
  }

  const score = Math.round((matched / tokens.length) * 100);
  const drifted = score < 50;
  const summary = drifted
    ? `Drifted — ${details.length} signal(s) missing (score: ${score})`
    : `Aligned (score: ${score})`;

  return { drifted, score, summary, details };
}

module.exports = { detectDrift };
