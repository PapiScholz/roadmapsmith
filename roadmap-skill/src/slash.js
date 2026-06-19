'use strict';

const SLASH_ACTIONS = [
  {
    id: 'zero',
    description: 'Interview the developer in terminal and generate the first roadmap for an empty or low-context repo.',
    classicCliExample: 'roadmapsmith zero',
    taskLabel: 'RoadmapSmith: Zero Mode'
  },
  {
    id: 'maintain',
    description: 'Preserve-first existing-repo flow: update, sync, and audit the roadmap without rebuilding substantive domain content.',
    classicCliExample: 'roadmapsmith maintain',
    taskLabel: 'RoadmapSmith: Maintain'
  },
  {
    id: 'status',
    description: 'Inspect CLI, roadmap, VS Code task, Codex, and Claude readiness.',
    classicCliExample: 'roadmapsmith status --json',
    taskLabel: 'RoadmapSmith: Status'
  },
  {
    id: 'init',
    description: 'Create ROADMAP.md and AGENTS.md when they are missing.',
    classicCliExample: 'roadmapsmith init',
    taskLabel: 'RoadmapSmith: Init'
  },
  {
    id: 'generate',
    description: 'Generate or update ROADMAP.md, refusing destructive replacement unless rerun with --full-regen.',
    classicCliExample: 'roadmapsmith generate --project-root .',
    taskLabel: 'RoadmapSmith: Generate'
  },
  {
    id: 'validate',
    description: 'Inspect per-task evidence status as JSON.',
    classicCliExample: 'roadmapsmith validate --json --project-root .',
    taskLabel: 'RoadmapSmith: Validate'
  },
  {
    id: 'sync',
    description: 'Apply evidence-backed checklist sync to ROADMAP.md.',
    classicCliExample: 'roadmapsmith sync --project-root .',
    taskLabel: 'RoadmapSmith: Sync'
  },
  {
    id: 'audit',
    description: 'Run sync and print the post-sync mismatch summary.',
    classicCliExample: 'roadmapsmith sync --audit --project-root .',
    taskLabel: 'RoadmapSmith: Sync Audit'
  },
  {
    id: 'setup',
    description: 'Generate visible VS Code tasks and optional Claude hook wiring.',
    classicCliExample: 'roadmapsmith setup',
    taskLabel: 'RoadmapSmith: Refresh Setup'
  }
];

const SLASH_ROOT_ALIASES = new Set(['/roadmap', '/road']);
const LEGACY_ROUTER_ALIAS = '/roadmap-sync';

function getNamespacedDirectSlash(actionId) {
  return actionId === 'sync' ? '/roadmap-update' : `/roadmap-${actionId}`;
}

const DIRECT_HOST_NATIVE_ALIAS_TO_ACTION = Object.freeze(
  Object.fromEntries(SLASH_ACTIONS.map((action) => [getNamespacedDirectSlash(action.id), action.id]))
);

const DIRECT_DEPRECATED_CLI_ALIAS_TO_ACTION = Object.freeze(
  Object.fromEntries(SLASH_ACTIONS.map((action) => [`/${action.id}`, action.id]))
);

function getHostNativeSkillNames() {
  return [
    'roadmap',
    'roadmap-zero',
    'roadmap-maintain',
    'roadmap-status',
    'roadmap-init',
    'roadmap-generate',
    'roadmap-validate',
    'roadmap-update',
    'roadmap-sync',
    'roadmap-audit',
    'roadmap-setup'
  ];
}

function getHostNativeSlashCommands() {
  return getHostNativeSkillNames().map((name) => `/${name}`);
}

function normalizeActionId(value) {
  let normalized = String(value || '').trim().toLowerCase().replace(/^\/+/, '');
  if (normalized.startsWith('roadmap-')) {
    normalized = normalized.slice('roadmap-'.length);
  }
  if (normalized === 'update') {
    normalized = 'sync';
  }
  return normalized;
}

function isSlashToken(value) {
  return typeof value === 'string' && value.trim().startsWith('/');
}

function getSlashAction(actionId) {
  const normalized = normalizeActionId(actionId);
  return SLASH_ACTIONS.find((action) => action.id === normalized) || null;
}

function getLegacyRouterSlash(action) {
  return `/roadmap-sync ${action.id === 'sync' ? 'update' : action.id}`;
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
  if (!normalized) {
    return getSlashActionSpecs();
  }

  const startsWithMatches = SLASH_ACTIONS.filter((action) => action.id.startsWith(normalized));
  const containsMatches = SLASH_ACTIONS.filter((action) => {
    return !action.id.startsWith(normalized) && action.id.includes(normalized);
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
    if (args.length === 0) {
      return paletteResponse(normalizedCommand, '');
    }

    const queryToken = normalizeActionId(args[0]);
    const deprecationMessage = 'Legacy CLI compatibility root /roadmap-sync <action> is deprecated. Use /roadmap <action> or the direct /roadmap-* commands.';
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
      lines.push(`  Legacy router: ${action.legacyRouterSlash}`);
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
  lines.push('- roadmapsmith /roadmap-sync validate');
  lines.push('');
  lines.push('Installing the skill alone does not expose CLI behavior in VS Code. Use roadmapsmith setup for the visible task/launcher layer.');

  return lines.join('\n');
}

module.exports = {
  DIRECT_DEPRECATED_CLI_ALIAS_TO_ACTION,
  DIRECT_HOST_NATIVE_ALIAS_TO_ACTION,
  LEGACY_ROUTER_ALIAS,
  SLASH_ROOT_ALIASES,
  getHostNativeSkillNames,
  getHostNativeSlashCommands,
  getNamespacedDirectSlash,
  getSlashAction,
  getSlashActionSpecs,
  getSlashSuggestions,
  isSlashToken,
  normalizeActionId,
  renderSlashPalette,
  resolveSlashInvocation
};
