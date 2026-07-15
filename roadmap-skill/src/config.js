'use strict';

const fs = require('fs');
const path = require('path');
const { readTextIfExists } = require('./io');

const DEFAULT_CONFIG = {
  roadmapFile: './ROADMAP.md',
  agentsFile: './AGENTS.md',
  taskMatchers: [],
  validators: [],
  customSections: [],
  plugins: [],
  pathAliases: {},
  product: {
    name: '',
    northStar: '',
    positioning: '',
    primaryUser: '',
    problemStatement: '',
    targetUser: '',
    targetOutcome: '',
    antiGoals: [],
    risks: [],
    successCriteria: [],
    steps: [],
    phases: []
  },
  zeroMode: {
    problemStatement: '',
    preferredStack: '',
    constraints: [],
    doneCriteria: []
  },
  scan: {
    excludeDirs: []
  },
  validation: {
    minimumConfidence: 'low',
    testReports: [],
    recipeCommand: ''
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
    pathAliases: (userConfig && typeof userConfig.pathAliases === 'object' && !Array.isArray(userConfig.pathAliases) && userConfig.pathAliases !== null)
      ? userConfig.pathAliases
      : DEFAULT_CONFIG.pathAliases,
    milestones: Array.isArray(userConfig.milestones) ? userConfig.milestones : DEFAULT_CONFIG.milestones,
    phaseTemplates: {
      ...DEFAULT_CONFIG.phaseTemplates,
      ...((userConfig && userConfig.phaseTemplates) || {})
    },
    product: (() => {
      const merged = {
        ...DEFAULT_CONFIG.product,
        ...((userConfig && userConfig.product) || {}),
        phases: (userConfig && userConfig.product && Array.isArray(userConfig.product.phases))
          ? userConfig.product.phases
          : DEFAULT_CONFIG.product.phases
      };
      // Backwards compat (pre-v0.13): fall back to zeroMode.problemStatement if product.problemStatement is empty.
      if (!merged.problemStatement && userConfig && userConfig.zeroMode && userConfig.zeroMode.problemStatement) {
        merged.problemStatement = userConfig.zeroMode.problemStatement;
      }
      return merged;
    })(),
    zeroMode: {
      ...DEFAULT_CONFIG.zeroMode,
      ...((userConfig && userConfig.zeroMode) || {}),
      constraints: (userConfig && userConfig.zeroMode && Array.isArray(userConfig.zeroMode.constraints))
        ? userConfig.zeroMode.constraints
        : DEFAULT_CONFIG.zeroMode.constraints,
      doneCriteria: (userConfig && userConfig.zeroMode && Array.isArray(userConfig.zeroMode.doneCriteria))
        ? userConfig.zeroMode.doneCriteria
        : DEFAULT_CONFIG.zeroMode.doneCriteria
    },
    scan: {
      excludeDirs: Array.isArray(userConfig && userConfig.scan && userConfig.scan.excludeDirs)
        ? userConfig.scan.excludeDirs
        : DEFAULT_CONFIG.scan.excludeDirs
    },
    validation: {
      ...DEFAULT_CONFIG.validation,
      ...((userConfig && userConfig.validation) || {}),
      testReports: userConfig && userConfig.validation && Array.isArray(userConfig.validation.testReports)
        ? userConfig.validation.testReports
        : DEFAULT_CONFIG.validation.testReports
    }
  };
}

function findConfigUpwards(startDir, filename) {
  let current = path.resolve(startDir);
  while (true) {
    const candidate = path.join(current, filename);
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch (_) { /* ignore stat errors, keep walking */ }
    const parent = path.dirname(current);
    if (parent === current) return null; // reached filesystem root
    current = parent;
  }
}

function resolveConfigPath(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  if (options.configPath) {
    return path.resolve(projectRoot, String(options.configPath));
  }
  // v0.13.6: walk up directories looking for roadmap-skill.config.json so users can invoke
  // the CLI from a nested sub-directory (roadmap-skill/, packages/foo/) without --config.
  const found = findConfigUpwards(projectRoot, 'roadmap-skill.config.json');
  return found || path.resolve(projectRoot, 'roadmap-skill.config.json');
}

function loadConfig(options = {}) {
  const resolvedConfigPath = resolveConfigPath(options);

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

function readUserConfig(options = {}) {
  const resolvedConfigPath = resolveConfigPath(options);
  const content = readTextIfExists(resolvedConfigPath);
  if (!content) {
    return {};
  }
  return safeParseJson(content, resolvedConfigPath);
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
  readUserConfig,
  resolveAgentsFile,
  resolveConfigPath,
  resolveRoadmapFile
};
