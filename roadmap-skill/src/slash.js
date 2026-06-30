'use strict';

const SLASH_ACTIONS = [
  {
    id: 'init',
    tier: 'canonical',
    description: 'Create ROADMAP.md, AGENTS.md, and host integration files for a project.',
    classicCliExample: 'roadmapsmith init --project-root .',
    taskLabel: 'RoadmapSmith: Init'
  },
  {
    id: 'update',
    tier: 'canonical',
    description: 'Refresh ROADMAP.md with evidence-backed validation, add tasks, or record evidence.',
    classicCliExample: 'roadmapsmith update --project-root .',
    taskLabel: 'RoadmapSmith: Update'
  }
];

const SLASH_ROOT_ALIASES = new Set(['/roadmap', '/road']);
const LEGACY_ROUTER_ALIAS = '/roadmap-sync';
const CANONICAL_ACTION_IDS = Object.freeze(SLASH_ACTIONS.filter((action) => action.tier === 'canonical').map((action) => action.id));
const ADVANCED_ACTION_IDS = Object.freeze(SLASH_ACTIONS.filter((action) => action.tier === 'advanced').map((action) => action.id));
const COMPATIBILITY_ACTION_IDS = Object.freeze([]);

function getNamespacedDirectSlash(actionId) {
  return `/roadmap-${actionId}`;
}

const DIRECT_HOST_NATIVE_ALIAS_TO_ACTION = Object.freeze(
  Object.fromEntries(SLASH_ACTIONS.map((action) => [getNamespacedDirectSlash(action.id), action.id]))
);

const DIRECT_DEPRECATED_CLI_ALIAS_TO_ACTION = Object.freeze(
  Object.fromEntries(
    SLASH_ACTIONS.flatMap((action) => {
      const aliases = Array.isArray(action.aliases) ? action.aliases : [];
      return [action.id, ...aliases].map((alias) => [`/${alias}`, action.id]);
    })
  )
);

const ACTION_ALIAS_TO_ID = Object.freeze(
  Object.fromEntries(
    SLASH_ACTIONS.flatMap((action) => {
      const aliases = Array.isArray(action.aliases) ? action.aliases : [];
      return [action.id, ...aliases].map((alias) => [alias, action.id]);
    })
  )
);

function mapActionIdsToSkillNames(actionIds) {
  return actionIds.map((actionId) => getNamespacedDirectSlash(actionId).slice(1));
}

function getCanonicalHostNativeSkillNames() {
  return mapActionIdsToSkillNames(CANONICAL_ACTION_IDS);
}

function getAdvancedHostNativeSkillNames() {
  return ADVANCED_ACTION_IDS.map((actionId) => getNamespacedDirectSlash(actionId).slice(1));
}

function getCompatibilityHostNativeSkillNames() {
  return [];
}

function getHostNativeSkillNames() {
  return [
    ...getCanonicalHostNativeSkillNames(),
    ...getAdvancedHostNativeSkillNames(),
    ...getCompatibilityHostNativeSkillNames()
  ];
}

function getCanonicalHostNativeSlashCommands() {
  return getCanonicalHostNativeSkillNames().map((name) => `/${name}`);
}

function getAdvancedHostNativeSlashCommands() {
  return getAdvancedHostNativeSkillNames().map((name) => `/${name}`);
}

function getCompatibilityHostNativeSlashCommands() {
  return getCompatibilityHostNativeSkillNames().map((name) => `/${name}`);
}

function getHostNativeSlashCommands() {
  return getHostNativeSkillNames().map((name) => `/${name}`);
}

function normalizeActionId(value) {
  let normalized = String(value || '').trim().toLowerCase().replace(/^\/+/, '');
  if (normalized.startsWith('roadmap-')) {
    normalized = normalized.slice('roadmap-'.length);
  }
  return normalized;
}

function canonicalizeActionId(value) {
  const normalized = normalizeActionId(value);
  return ACTION_ALIAS_TO_ID[normalized] || normalized;
}

function isSlashToken(value) {
  return typeof value === 'string' && value.trim().startsWith('/');
}

function getSlashAction(actionId) {
  const normalized = canonicalizeActionId(actionId);
  return SLASH_ACTIONS.find((action) => action.id === normalized) || null;
}

function getLegacyRouterSlash(action) {
  return `/roadmap-sync ${action.id}`;
}

function actionSearchTerms(action) {
  return [action.id, ...(Array.isArray(action.aliases) ? action.aliases : [])];
}

function getSlashActionSpecs() {
  return SLASH_ACTIONS.map((action) => ({
    ...action,
    directSlash: getNamespacedDirectSlash(action.id),
    routerSlash: `/roadmap ${action.id}`,
    legacyRouterSlash: getLegacyRouterSlash(action)
  }));
}

function getSlashSuggestions(query) {
  const normalized = normalizeActionId(query);
  const visibleActions = SLASH_ACTIONS.filter((action) => action.tier !== 'compatibility');
  if (!normalized) {
    return visibleActions.map((action) => ({
      ...action,
      directSlash: getNamespacedDirectSlash(action.id),
      routerSlash: `/roadmap ${action.id}`,
      legacyRouterSlash: getLegacyRouterSlash(action)
    }));
  }

  const startsWithMatches = visibleActions.filter((action) => {
    return actionSearchTerms(action).some((term) => term.startsWith(normalized));
  });
  const containsMatches = visibleActions.filter((action) => {
    return !actionSearchTerms(action).some((term) => term.startsWith(normalized))
      && actionSearchTerms(action).some((term) => term.includes(normalized));
  });

  return [...startsWithMatches, ...containsMatches].map((action) => ({
    ...action,
    directSlash: getNamespacedDirectSlash(action.id),
    routerSlash: `/roadmap ${action.id}`,
    legacyRouterSlash: getLegacyRouterSlash(action)
  }));
}

function paletteResponse(source, query, deprecated = false, deprecationMessage = '') {
  return {
    kind: 'palette',
    query,
    source,
    suggestions: getSlashSuggestions(query),
    deprecated,
    deprecationMessage
  };
}

function executeResponse(source, actionId, query, deprecated = false, deprecationMessage = '') {
  return {
    kind: 'execute',
    actionId,
    query,
    source,
    suggestions: getSlashSuggestions(query),
    deprecated,
    deprecationMessage
  };
}

function resolveSlashInvocation(command, args = []) {
  if (!isSlashToken(command)) {
    return null;
  }

  const normalizedCommand = String(command).trim().toLowerCase();

  if (normalizedCommand === LEGACY_ROUTER_ALIAS) {
    const deprecationMessage = 'Legacy CLI compatibility root /roadmap-sync <action> is deprecated. Use /roadmap <action> or the direct /roadmap-* commands.';
    if (args.length === 0) {
      return paletteResponse(normalizedCommand, '', true, deprecationMessage);
    }

    const queryToken = normalizeActionId(args[0]);
    const exactAction = getSlashAction(queryToken);
    if (exactAction) {
      return executeResponse(normalizedCommand, exactAction.id, queryToken, true, deprecationMessage);
    }

    return paletteResponse(normalizedCommand, queryToken, true, deprecationMessage);
  }

  if (Object.prototype.hasOwnProperty.call(DIRECT_HOST_NATIVE_ALIAS_TO_ACTION, normalizedCommand)) {
    return executeResponse(
      normalizedCommand,
      DIRECT_HOST_NATIVE_ALIAS_TO_ACTION[normalizedCommand],
      normalizeActionId(normalizedCommand)
    );
  }

  if (Object.prototype.hasOwnProperty.call(DIRECT_DEPRECATED_CLI_ALIAS_TO_ACTION, normalizedCommand)) {
    const actionId = DIRECT_DEPRECATED_CLI_ALIAS_TO_ACTION[normalizedCommand];
    return executeResponse(
      normalizedCommand,
      actionId,
      normalizeActionId(normalizedCommand),
      true,
      `CLI compatibility alias ${normalizedCommand} is deprecated. Use ${getNamespacedDirectSlash(actionId)} or /roadmap ${actionId}.`
    );
  }

  if (SLASH_ROOT_ALIASES.has(normalizedCommand)) {
    const queryToken = args.length > 0 ? normalizeActionId(args[0]) : '';
    const deprecated = normalizedCommand === '/road';
    const deprecationMessage = deprecated
      ? 'CLI compatibility alias /road is deprecated. Use /roadmap.'
      : '';

    if (!queryToken) {
      return paletteResponse(normalizedCommand, '', deprecated, deprecationMessage);
    }

    const exactAction = getSlashAction(queryToken);
    if (exactAction) {
      return executeResponse(normalizedCommand, exactAction.id, queryToken, deprecated, deprecationMessage);
    }

    return paletteResponse(normalizedCommand, queryToken, deprecated, deprecationMessage);
  }

  if (normalizedCommand.startsWith('/roadmap-')) {
    return paletteResponse(normalizedCommand, normalizeActionId(normalizedCommand));
  }

  return paletteResponse(normalizedCommand, normalizeActionId(normalizedCommand));
}

function renderSlashPalette(options = {}) {
  const source = options.source || '/roadmap';
  const query = normalizeActionId(options.query);
  const suggestions = Array.isArray(options.suggestions) ? options.suggestions : getSlashSuggestions(query);
  const lines = [];

  lines.push('RoadmapSmith slash palette');
  lines.push('');

  if (options.deprecated && options.deprecationMessage) {
    lines.push(`Deprecated alias: ${options.deprecationMessage}`);
    lines.push('');
  }

  if (query) {
    lines.push(`Input: ${source} ${query}`);
    if (suggestions.length > 0) {
      lines.push('No exact slash match was executed. Related actions:');
    } else {
      lines.push('No exact slash match was executed.');
    }
  } else {
    lines.push(`Entry point: ${source}`);
    lines.push('Use an exact slash action to execute work. Incomplete or ambiguous input only shows suggestions.');
  }

  lines.push('');

  if (suggestions.length === 0) {
    lines.push('No related slash actions found.');
  } else {
    suggestions.forEach((action) => {
      lines.push(`- ${action.directSlash}: ${action.description}`);
      lines.push(`  Router form: ${action.routerSlash}`);
      if (options.deprecated || source === LEGACY_ROUTER_ALIAS) {
        lines.push(`  Legacy router: ${action.legacyRouterSlash}`);
      }
      lines.push(`  Classic CLI: ${action.classicCliExample}`);
      lines.push(`  VS Code task: ${action.taskLabel}`);
    });
  }

  lines.push('');
  lines.push('Examples:');
  lines.push('- roadmapsmith /roadmap');
  lines.push('- roadmapsmith /roadmap maintain');
  lines.push('- roadmapsmith /roadmap-maintain');
  lines.push('- roadmapsmith /roadmap-update');
  if (options.deprecated || source === LEGACY_ROUTER_ALIAS) {
    lines.push('- roadmapsmith /roadmap-sync validate');
  }
  lines.push('');
  lines.push('Installing the skill alone does not expose CLI behavior in VS Code. Use roadmapsmith setup for the visible task/launcher layer.');

  return lines.join('\n');
}

module.exports = {
  ACTION_ALIAS_TO_ID,
  DIRECT_DEPRECATED_CLI_ALIAS_TO_ACTION,
  DIRECT_HOST_NATIVE_ALIAS_TO_ACTION,
  ADVANCED_ACTION_IDS,
  CANONICAL_ACTION_IDS,
  COMPATIBILITY_ACTION_IDS,
  LEGACY_ROUTER_ALIAS,
  SLASH_ROOT_ALIASES,
  getAdvancedHostNativeSkillNames,
  getAdvancedHostNativeSlashCommands,
  getCanonicalHostNativeSkillNames,
  getCanonicalHostNativeSlashCommands,
  getCompatibilityHostNativeSkillNames,
  getCompatibilityHostNativeSlashCommands,
  getHostNativeSkillNames,
  getHostNativeSlashCommands,
  getNamespacedDirectSlash,
  getSlashAction,
  getSlashActionSpecs,
  getSlashSuggestions,
  isSlashToken,
  canonicalizeActionId,
  normalizeActionId,
  renderSlashPalette,
  resolveSlashInvocation
};
