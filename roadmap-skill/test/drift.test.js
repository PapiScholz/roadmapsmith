'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { detectDrift } = require('../src/drift');

test('score is 100 when northStar has no checkable tokens', () => {
  const result = detectDrift('the of in', {
    languages: ['python'], testFrameworks: [], modules: [], projectType: 'backend'
  });
  assert.equal(result.score, 100);
  assert.equal(result.drifted, false);
  assert.deepEqual(result.details, []);
});

test('detects drift when northStar mentions react but repo has python', () => {
  const result = detectDrift('Build react app', {
    languages: ['python'], testFrameworks: [], modules: [], projectType: 'backend'
  });
  assert.equal(result.drifted, true);
  assert.ok(result.score < 50);
  assert.ok(result.details.some((d) => d.includes('react')));
});

test('not drifted when most tokens match', () => {
  const result = detectDrift('Build react app with typescript', {
    languages: ['javascript', 'typescript'],
    testFrameworks: ['jest'],
    modules: ['react'],
    projectType: 'frontend'
  });
  assert.equal(result.drifted, false);
  assert.ok(result.score >= 50);
});

test('details lists each unmatched token', () => {
  const result = detectDrift('Use graphql and redis', {
    languages: ['javascript'], testFrameworks: [], modules: [], projectType: 'backend'
  });
  assert.ok(result.details.some((d) => d.includes('graphql')), 'must mention graphql');
  assert.ok(result.details.some((d) => d.includes('redis')), 'must mention redis');
});

test('summary contains the score number', () => {
  const result = detectDrift('Build nodejs api', {
    languages: ['javascript'], testFrameworks: [], modules: ['api'], projectType: 'backend'
  });
  assert.ok(result.summary.includes(String(result.score)));
});

test('handles null/empty inputs gracefully', () => {
  const result = detectDrift('', null);
  assert.equal(result.score, 100);
  assert.equal(result.drifted, false);
});

test('English filler and generic product words are stripped before scoring', () => {
  // Real regression: pre-v0.13.4 this northStar produced score=0 (100% false-positive drift)
  // because every filler token ("make", "every", "project", ...) reported as unmatched.
  const result = detectDrift(
    'Make every software project ship with a living, evidence-backed roadmap — zero manual maintenance.',
    { languages: ['javascript'], testFrameworks: ['node:test'], modules: ['roadmap'], projectType: 'cli' }
  );
  assert.equal(result.drifted, false, `expected aligned, got: ${result.summary}\n${result.details.join('\n')}`);
  assert.ok(result.score >= 50, `score should be >= 50, got ${result.score}`);
});

test('extraSignals lets README/package.json text back domain vocabulary', () => {
  const result = detectDrift(
    'Ship an evidence-backed roadmap CLI',
    { languages: ['javascript'], testFrameworks: [], modules: [], projectType: 'cli' },
    ['roadmap tool for evidence-driven planning across repos']
  );
  assert.equal(result.drifted, false);
  assert.ok(result.details.length === 0 || result.details.every((d) => !d.includes('roadmap')));
});
