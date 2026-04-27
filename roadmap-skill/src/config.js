'use strict';

const fs = require('fs');
const path = require('path');
const { readTextIfExists } = require('./io');

const DEFAULT_CONFIG = {
  roadmapFile: './ROADMAP.md',
  agentsFile: './AGENTS.md',
  roadmapProfile: 'compact',
  taskMatchers: [],
  validators: [],
  customSections: [],
  plugins: [],
  product: {
    name: '',
    northStar: '',
    positioning: '',
    primaryUser: '',
    targetOutcome: '',
    antiGoals: [],
    risks: [],
    successCriteria: [],
    steps: [],
    phases: []
  },
  validation: {
    minimumConfidence: 'low'
  },
  milestones: [
    { version: 'v0.1', goal: 'Foundation baseline complete' },
    { version: 'v0.2', goal: 'Core feature coverage stabilized' },
    { version: 'v0.3', goal: 'Release candidate hardening complete' },
    { version: 'v1.0', goal: 'Production readiness exit criteria met' }
  ],
  phaseTemplates: {
    P0: [
      'Stabilize project baseline and unblock high-risk delivery paths',
      'Implement critical tasks required for milestone v0.1'
    ],
    P1: [
      'Expand feature completeness and improve reliability',
      'Reduce operational risk before v0.3'
    ],
    P2: [
      'Complete final hardening and release readiness for v1.0',
      'Close non-critical backlog aligned to anti-goals'
    ]
  }
};

function safeParseJson(content, filePath) {
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
  }
}

function mergeConfig(userConfig) {
  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
    taskMatchers: Array.isArray(userConfig.taskMatchers) ? userConfig.taskMatchers : DEFAULT_CONFIG.taskMatchers,
    validators: Array.isArray(userConfig.validators) ? userConfig.validators : DEFAULT_CONFIG.validators,
    customSections: Array.isArray(userConfig.customSections) ? userConfig.customSections : DEFAULT_CONFIG.customSections,
    plugins: Array.isArray(userConfig.plugins) ? userConfig.plugins : DEFAULT_CONFIG.plugins,
    milestones: Array.isArray(userConfig.milestones) ? userConfig.milestones : DEFAULT_CONFIG.milestones,
    phaseTemplates: {
      ...DEFAULT_CONFIG.phaseTemplates,
      ...((userConfig && userConfig.phaseTemplates) || {})
    },
    product: {
      ...DEFAULT_CONFIG.product,
      ...((userConfig && userConfig.product) || {}),
      phases: (userConfig && userConfig.product && Array.isArray(userConfig.product.phases))
        ? userConfig.product.phases
        : DEFAULT_CONFIG.product.phases
    },
    validation: {
      ...DEFAULT_CONFIG.validation,
      ...((userConfig && userConfig.validation) || {})
    }
  };
}

function loadConfig(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  const resolvedConfigPath = options.configPath
    ? path.resolve(projectRoot, String(options.configPath))
    : path.resolve(projectRoot, 'roadmap-skill.config.json');

  const content = readTextIfExists(resolvedConfigPath);
  let userConfig = {};
  if (!content) {
    const merged = mergeConfig(userConfig);
    Object.defineProperty(merged, '__roadmapFileExplicit', {
      value: false,
      enumerable: false,
      configurable: false,
      writable: false
    });
    return merged;
  }

  userConfig = safeParseJson(content, resolvedConfigPath);
  const merged = mergeConfig(userConfig);
  Object.defineProperty(merged, '__roadmapFileExplicit', {
    value: Object.prototype.hasOwnProperty.call(userConfig, 'roadmapFile'),
    enumerable: false,
    configurable: false,
    writable: false
  });
  return merged;
}

function resolveRoadmapFile(projectRoot, config, overridePath) {
  if (overridePath) {
    return path.resolve(projectRoot, overridePath);
  }

  const configuredRoadmapFile =
    config && typeof config.roadmapFile === 'string' ? config.roadmapFile.trim() : '';
  const hasExplicitRoadmapFile = Boolean(config && config.__roadmapFileExplicit);
  const hasCustomConfigRoadmapFile =
    configuredRoadmapFile.length > 0 &&
    (hasExplicitRoadmapFile || configuredRoadmapFile !== DEFAULT_CONFIG.roadmapFile);

  if (hasCustomConfigRoadmapFile) {
    return path.resolve(projectRoot, configuredRoadmapFile);
  }

  let rootEntries = null;
  try {
    rootEntries = fs.readdirSync(projectRoot);
  } catch {
    rootEntries = null;
  }

  const canonicalRoadmapPath = path.resolve(projectRoot, DEFAULT_CONFIG.roadmapFile);
  const legacyRoadmapPath = path.resolve(projectRoot, './roadmap.md');

  const hasCanonicalRoadmap = Array.isArray(rootEntries)
    ? rootEntries.includes('ROADMAP.md')
    : readTextIfExists(canonicalRoadmapPath) != null;
  const hasLegacyRoadmap = Array.isArray(rootEntries)
    ? rootEntries.includes('roadmap.md')
    : readTextIfExists(legacyRoadmapPath) != null;

  if (hasCanonicalRoadmap) {
    return canonicalRoadmapPath;
  }
  if (hasLegacyRoadmap) {
    return legacyRoadmapPath;
  }
  return canonicalRoadmapPath;
}

function resolveAgentsFile(projectRoot, config, overridePath) {
  if (overridePath) {
    return path.resolve(projectRoot, overridePath);
  }

  const agentsPath = path.resolve(projectRoot, config.agentsFile || './AGENTS.md');
  const claudePath = path.resolve(projectRoot, './CLAUDE.md');

  if (readTextIfExists(agentsPath) != null) {
    return agentsPath;
  }
  if (readTextIfExists(claudePath) != null) {
    return claudePath;
  }
  return agentsPath;
}

function loadPlugins(projectRoot, pluginEntries) {
  const plugins = [];
  for (const entry of pluginEntries || []) {
    const pluginPath = path.resolve(projectRoot, entry);
    const pluginModule = require(pluginPath);
    plugins.push({
      name: path.basename(pluginPath),
      path: pluginPath,
      module: pluginModule
    });
  }
  return plugins;
}

function collectPluginContributions(plugins, hookName, context) {
  const contributions = [];
  for (const plugin of plugins || []) {
    const hook = plugin.module && plugin.module[hookName];
    if (typeof hook !== 'function') {
      continue;
    }
    let result;
    try {
      result = hook(context);
    } catch (err) {
      throw new Error(`Plugin "${plugin.name}" failed in hook "${hookName}": ${err.message}`);
    }
    if (Array.isArray(result)) {
      for (const item of result) {
        contributions.push(item);
      }
    }
  }
  return contributions;
}

module.exports = {
  DEFAULT_CONFIG,
  collectPluginContributions,
  loadConfig,
  loadPlugins,
  resolveAgentsFile,
  resolveRoadmapFile
};
