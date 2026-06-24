'use strict';

const path = require('path');

const ZERO_MODE_FLAG_SPECS = {
  productName: { flag: '--product-name', configPath: 'product.name', type: 'scalar' },
  primaryUser: { flag: '--primary-user', configPath: 'product.primaryUser', type: 'scalar', required: true },
  problemStatement: { flag: '--problem-statement', configPath: 'zeroMode.problemStatement', type: 'scalar', required: true },
  targetOutcome: { flag: '--target-outcome', configPath: 'product.targetOutcome', type: 'scalar', required: true },
  antiGoals: { flag: '--anti-goal', configPath: 'product.antiGoals', type: 'list' },
  preferredStack: { flag: '--preferred-stack', configPath: 'zeroMode.preferredStack', type: 'scalar' },
  constraints: { flag: '--constraint', configPath: 'zeroMode.constraints', type: 'list' },
  doneCriteria: { flag: '--done-criterion', configPath: 'zeroMode.doneCriteria', type: 'list', required: true }
};

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

function getSingleFlagValue(value) {
  if (Array.isArray(value)) {
    return value[value.length - 1];
  }
  return value;
}

function getListFlagValues(value) {
  const rawValues = Array.isArray(value) ? value : [value];
  return rawValues.flatMap((item) => splitListAnswer(item));
}

function resolveZeroModeAnswers(projectRoot, config, flags = {}) {
  const defaults = buildZeroModeDefaults(projectRoot, config);
  const answers = { ...defaults };

  for (const [field, spec] of Object.entries(ZERO_MODE_FLAG_SPECS)) {
    const flagKey = spec.flag.slice(2);
    if (!Object.prototype.hasOwnProperty.call(flags, flagKey)) {
      continue;
    }

    if (spec.type === 'list') {
      answers[field] = getListFlagValues(flags[flagKey]).join('; ');
      continue;
    }

    const raw = getSingleFlagValue(flags[flagKey]);
    answers[field] = String(raw == null ? '' : raw).trim();
  }

  if (!String(answers.productName || '').trim()) {
    answers.productName = path.basename(projectRoot);
  }

  return answers;
}

function getMissingZeroModeFields(answers = {}) {
  const missing = [];
  for (const [field, spec] of Object.entries(ZERO_MODE_FLAG_SPECS)) {
    if (!spec.required) {
      continue;
    }

    if (spec.type === 'list') {
      if (splitListAnswer(answers[field]).length === 0) {
        missing.push({
          field,
          flag: spec.flag,
          configPath: spec.configPath
        });
      }
      continue;
    }

    if (!String(answers[field] || '').trim()) {
      missing.push({
        field,
        flag: spec.flag,
        configPath: spec.configPath
      });
    }
  }
  return missing;
}

function formatMissingZeroModeFields(missingFields) {
  return missingFields.map((item) => {
    const label = item.field.replace(/([A-Z])/g, ' $1').toLowerCase();
    return `${label} (${item.flag} or config ${item.configPath})`;
  });
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
  formatMissingZeroModeFields,
  getMissingZeroModeFields,
  isInteractiveTerminal,
  resolveZeroModeAnswers,
  splitListAnswer
};
