'use strict';

const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildZeroModeConfigPatch,
  buildZeroModeDefaults,
  collectZeroModeAnswers,
  formatMissingZeroModeFields,
  getMissingZeroModeFields,
  resolveZeroModeAnswers,
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

test('resolveZeroModeAnswers merges config defaults with scalar and repeated CLI flags', () => {
  const answers = resolveZeroModeAnswers(path.join(process.cwd(), 'demo-repo'), {
    product: {
      name: 'Configured Product',
      primaryUser: 'Configured user',
      targetOutcome: 'configured outcome',
      antiGoals: ['Configured anti-goal'],
      successCriteria: ['Configured done']
    },
    zeroMode: {
      problemStatement: 'Configured problem',
      preferredStack: 'Configured stack',
      constraints: ['Configured constraint'],
      doneCriteria: ['Configured done']
    }
  }, {
    'primary-user': 'Flag user',
    'anti-goal': ['No billing', 'No marketplace'],
    'constraint': 'Ship in 2 weeks; low budget',
    'done-criterion': ['One user completes onboarding', 'One user syncs the roadmap'],
    'preferred-stack': 'Node + React'
  });

  assert.equal(answers.productName, 'Configured Product');
  assert.equal(answers.primaryUser, 'Flag user');
  assert.equal(answers.problemStatement, 'Configured problem');
  assert.equal(answers.targetOutcome, 'configured outcome');
  assert.equal(answers.preferredStack, 'Node + React');
  assert.equal(answers.antiGoals, 'No billing; No marketplace');
  assert.equal(answers.constraints, 'Ship in 2 weeks; low budget');
  assert.equal(answers.doneCriteria, 'One user completes onboarding; One user syncs the roadmap');
});

test('getMissingZeroModeFields reports required non-interactive brief gaps with flag/config hints', () => {
  const missing = getMissingZeroModeFields({
    productName: 'Demo Product',
    primaryUser: '',
    problemStatement: '',
    targetOutcome: 'Launch the beta',
    doneCriteria: ''
  });

  assert.deepEqual(missing.map((item) => item.field), ['primaryUser', 'problemStatement', 'doneCriteria']);
  assert.deepEqual(formatMissingZeroModeFields(missing), [
    'primary user (--primary-user or config product.primaryUser)',
    'problem statement (--problem-statement or config zeroMode.problemStatement)',
    'done criteria (--done-criterion or config zeroMode.doneCriteria)'
  ]);
});
