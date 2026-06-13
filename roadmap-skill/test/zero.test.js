'use strict';

const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildZeroModeConfigPatch,
  buildZeroModeDefaults,
  collectZeroModeAnswers,
  splitListAnswer
} = require('../src/zero');

test('splitListAnswer separates semicolon-delimited discovery answers', () => {
  assert.deepEqual(splitListAnswer('one; two ;three'), ['one', 'two', 'three']);
});

test('collectZeroModeAnswers uses defaults when the user submits empty answers', async () => {
  const prompts = [];
  const answers = await collectZeroModeAnswers(async (prompt) => {
    prompts.push(prompt);
    return '';
  }, {
    productName: 'RoadmapSmith',
    primaryUser: 'Developers'
  });

  assert.equal(prompts.length, 8);
  assert.equal(answers.productName, 'RoadmapSmith');
  assert.equal(answers.primaryUser, 'Developers');
});

test('buildZeroModeDefaults reads existing product and zeroMode config', () => {
  const defaults = buildZeroModeDefaults(path.join(process.cwd(), 'demo-repo'), {
    product: {
      name: 'Demo Product',
      primaryUser: 'Founders',
      targetOutcome: 'ship the first internal beta',
      antiGoals: ['No marketplace yet'],
      successCriteria: ['First user can complete the core flow']
    },
    zeroMode: {
      problemStatement: 'Planning is fragmented across sessions',
      preferredStack: 'Node + React',
      constraints: ['Bootstrap in 2 weeks']
    }
  });

  assert.equal(defaults.productName, 'Demo Product');
  assert.equal(defaults.problemStatement, 'Planning is fragmented across sessions');
  assert.equal(defaults.preferredStack, 'Node + React');
  assert.equal(defaults.constraints, 'Bootstrap in 2 weeks');
  assert.equal(defaults.doneCriteria, 'First user can complete the core flow');
});

test('buildZeroModeConfigPatch persists interview answers into product and zeroMode blocks', () => {
  const next = buildZeroModeConfigPatch(process.cwd(), {
    roadmapProfile: 'professional',
    product: {
      name: 'Old Name'
    }
  }, {
    productName: 'Launchpad',
    primaryUser: 'Solo founders',
    problemStatement: 'They lose roadmap continuity between agent sessions',
    targetOutcome: 'ship a first usable planning workflow',
    antiGoals: 'No team permissions yet; No billing system',
    preferredStack: 'Next.js + Node',
    constraints: '2 weeks; low budget',
    doneCriteria: 'One founder can generate a roadmap; One founder can sync it after code changes'
  });

  assert.equal(next.roadmapProfile, 'professional');
  assert.equal(next.product.name, 'Launchpad');
  assert.equal(next.product.primaryUser, 'Solo founders');
  assert.equal(next.product.targetOutcome, 'ship a first usable planning workflow');
  assert.equal(next.product.positioning, 'Core problem: They lose roadmap continuity between agent sessions');
  assert.deepEqual(next.product.antiGoals, ['No team permissions yet', 'No billing system']);
  assert.deepEqual(next.product.risks, ['Constraint: 2 weeks', 'Constraint: low budget']);
  assert.deepEqual(next.product.successCriteria, [
    'One founder can generate a roadmap',
    'One founder can sync it after code changes'
  ]);
  assert.equal(next.zeroMode.preferredStack, 'Next.js + Node');
  assert.deepEqual(next.zeroMode.constraints, ['2 weeks', 'low budget']);
});
