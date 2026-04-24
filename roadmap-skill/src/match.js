'use strict';

const { similarityScore, slugify, tokenize, uniqueBy } = require('./utils');
const { PHASE_ORDER } = require('./model');

function canonicalSignature(text) {
  const tokens = uniqueBy(tokenize(text), (token) => token).slice(0, 8);
  return tokens.join('-') || slugify(text);
}

function inferPriorityWeight(priority) {
  const normalized = String(priority || '').toUpperCase();
  if (normalized === 'P0') return 0;
  if (normalized === 'P1') return 1;
  if (normalized === 'P2') return 2;
  return 3;
}

function findBestTaskMatch(candidate, existingTasks, minScore = 0.55) {
  const direct = existingTasks.find((task) => task.id === candidate.id);
  if (direct) {
    return { task: direct, score: 1 };
  }

  let best = null;
  for (const task of existingTasks) {
    const score = similarityScore(candidate.text, task.text);
    if (score < minScore) {
      continue;
    }
    if (!best || score > best.score) {
      best = { task, score };
    }
  }

  return best;
}

function dedupeTasks(tasks) {
  const grouped = new Map();

  for (const task of tasks) {
    const signature = canonicalSignature(task.text);
    if (!grouped.has(signature)) {
      grouped.set(signature, task);
      continue;
    }

    const current = grouped.get(signature);
    const candidate = task;

    if (current.checked !== candidate.checked) {
      grouped.set(signature, candidate.checked ? candidate : current);
      continue;
    }

    const currentWeight = inferPriorityWeight(current.priority);
    const candidateWeight = inferPriorityWeight(candidate.priority);
    if (candidateWeight < currentWeight) {
      grouped.set(signature, candidate);
      continue;
    }

    if (candidateWeight === currentWeight && candidate.text.length < current.text.length) {
      grouped.set(signature, candidate);
    }
  }

  return Array.from(grouped.values()).sort((left, right) => {
    const leftPhase = PHASE_ORDER.indexOf(left.phase);
    const rightPhase = PHASE_ORDER.indexOf(right.phase);
    if (leftPhase !== rightPhase) {
      return leftPhase - rightPhase;
    }
    if (left.priority !== right.priority) {
      return inferPriorityWeight(left.priority) - inferPriorityWeight(right.priority);
    }
    return left.text.localeCompare(right.text);
  });
}

module.exports = {
  canonicalSignature,
  dedupeTasks,
  findBestTaskMatch
};
