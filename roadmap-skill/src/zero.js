'use strict';

const path = require('path');

const ZERO_MODE_QUESTIONS = [
  { id: 'productName', prompt: '1. What product are we building?' },
  { id: 'primaryUser', prompt: '2. Who is the target user?' },
  { id: 'problemStatement', prompt: '3. What problem does it solve?' },
  { id: 'targetOutcome', prompt: '4. What is the desired v1.0 outcome?' },
  { id: 'antiGoals', prompt: '5. What is explicitly out of scope? Separate multiple items with ;' },
  { id: 'preferredStack', prompt: '6. What stack do you prefer, if any?' },
  { id: 'constraints', prompt: '7. What constraints exist? Separate multiple items with ;' },
  { id: 'doneCriteria', prompt: '8. What does "done" mean for the first usable version? Separate multiple items with ;' }
];

function splitListAnswer(value) {
  return String(value || '')
    .split(/(?:\r?\n|;)+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinListDefault(values) {
  return Array.isArray(values) && values.length > 0 ? values.join('; ') : '';
}

function deriveDefaultProblemStatement(config) {
  const explicit = config.zeroMode && config.zeroMode.problemStatement;
  if (explicit) {
    return explicit;
  }
  const positioning = String((config.product && config.product.positioning) || '').trim();
  const prefix = 'Core problem: ';
  if (positioning.startsWith(prefix)) {
    return positioning.slice(prefix.length).trim();
  }
  return '';
}

function buildZeroModeDefaults(projectRoot, config) {
  return {
    productName: (config.product && config.product.name) || path.basename(projectRoot),
    primaryUser: (config.product && config.product.primaryUser) || '',
    problemStatement: deriveDefaultProblemStatement(config),
    targetOutcome: (config.product && config.product.targetOutcome) || '',
    antiGoals: joinListDefault(config.product && config.product.antiGoals),
    preferredStack: (config.zeroMode && config.zeroMode.preferredStack) || '',
    constraints: joinListDefault(config.zeroMode && config.zeroMode.constraints),
    doneCriteria: joinListDefault(
      (config.zeroMode && config.zeroMode.doneCriteria && config.zeroMode.doneCriteria.length > 0)
        ? config.zeroMode.doneCriteria
        : (config.product && config.product.successCriteria)
    )
  };
}

async function collectZeroModeAnswers(ask, defaults = {}) {
  const answers = {};
  for (const question of ZERO_MODE_QUESTIONS) {
    const fallback = String(defaults[question.id] || '').trim();
    const suffix = fallback ? ` [${fallback}]` : '';
    const response = await ask(`${question.prompt}${suffix}: `);
    const normalized = String(response || '').trim();
    answers[question.id] = normalized || fallback;
  }
  return answers;
}

function deriveNorthStar(answers) {
  const productName = String(answers.productName || '').trim();
  const primaryUser = String(answers.primaryUser || '').trim();
  const targetOutcome = String(answers.targetOutcome || '').trim();
  if (productName && primaryUser && targetOutcome) {
    return `${productName} helps ${primaryUser} achieve ${targetOutcome}.`;
  }
  if (productName && targetOutcome) {
    return `${productName} exists to deliver ${targetOutcome}.`;
  }
  if (productName) {
    return `Ship the first usable version of ${productName}.`;
  }
  return '';
}

function buildZeroModeConfigPatch(projectRoot, existingUserConfig, answers) {
  const productName = String(answers.productName || '').trim() || path.basename(projectRoot);
  const primaryUser = String(answers.primaryUser || '').trim();
  const problemStatement = String(answers.problemStatement || '').trim();
  const targetOutcome = String(answers.targetOutcome || '').trim();
  const antiGoals = splitListAnswer(answers.antiGoals);
  const constraints = splitListAnswer(answers.constraints);
  const doneCriteria = splitListAnswer(answers.doneCriteria);
  const preferredStack = String(answers.preferredStack || '').trim();

  return {
    ...existingUserConfig,
    product: {
      ...((existingUserConfig && existingUserConfig.product) || {}),
      name: productName,
      northStar: deriveNorthStar({ productName, primaryUser, targetOutcome }) || (((existingUserConfig || {}).product || {}).northStar || ''),
      positioning: problemStatement ? `Core problem: ${problemStatement}` : ((((existingUserConfig || {}).product || {}).positioning) || ''),
      primaryUser,
      targetOutcome,
      antiGoals,
      risks: constraints.map((constraint) => `Constraint: ${constraint}`),
      successCriteria: doneCriteria
    },
    zeroMode: {
      ...((existingUserConfig && existingUserConfig.zeroMode) || {}),
      problemStatement,
      preferredStack,
      constraints,
      doneCriteria
    }
  };
}

function isInteractiveTerminal(input = process.stdin, output = process.stdout) {
  return Boolean(input && input.isTTY && output && output.isTTY);
}

module.exports = {
  ZERO_MODE_QUESTIONS,
  buildZeroModeConfigPatch,
  buildZeroModeDefaults,
  collectZeroModeAnswers,
  isInteractiveTerminal,
  splitListAnswer
};
