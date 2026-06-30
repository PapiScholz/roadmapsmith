'use strict';

const { tokenize } = require('./utils');

function detectDrift(northStar, scanResult) {
  const {
    languages = [],
    testFrameworks = [],
    modules = [],
    commands = [],
    projectType = ''
  } = scanResult || {};

  const signals = new Set(
    [...languages, ...testFrameworks, ...modules, ...commands, projectType]
      .map((s) => String(s).toLowerCase())
      .filter(Boolean)
  );

  const tokens = tokenize(String(northStar || '')).filter((t) => t.length >= 3);

  if (tokens.length === 0) {
    return { drifted: false, score: 100, summary: 'Aligned (score: 100)', details: [] };
  }

  const details = [];
  let matched = 0;

  for (const token of tokens) {
    const found = [...signals].some((s) => s.includes(token));
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
