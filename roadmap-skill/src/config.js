'use strict';

const path = require('path');
const { readTextIfExists } = require('./io');

const DEFAULT_CONFIG = {
  roadmapFile: './roadmap.md',
  agentsFile: './AGENTS.md',
  taskMatchers: [],
  validators: [],
  customSections: [],
  plugins: [],
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
    }
  };
}

function loadConfig(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  const resolvedConfigPath = options.configPath
    ? path.resolve(projectRoot, String(options.configPath))
    : path.resolve(projectRoot, 'roadmap-skill.config.json');

  const content = readTextIfExists(resolvedConfigPath);
  if (!content) {
    return mergeConfig({});
  }

  return mergeConfig(safeParseJson(content, resolvedConfigPath));
}

function resolveRoadmapFile(projectRoot, config, overridePath) {
  const target = overridePath || config.roadmapFile || './roadmap.md';
  return path.resolve(projectRoot, target);
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
    // eslint-disable-next-line global-require, import/no-dynamic-require
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
    const result = hook(context);
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
