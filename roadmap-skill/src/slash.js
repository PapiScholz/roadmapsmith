'use strict';

const SLASH_ACTIONS = [
  {
    id: 'zero',
    description: 'Interview the developer in terminal and generate the first roadmap for an empty or low-context repo.',
    classicCliExample: 'roadmapsmith zero',
    slashExamples: ['/zero', '/road zero', '/roadmap-sync zero'],
    taskLabel: 'RoadmapSmith: Zero Mode'
  },
  {
    id: 'maintain',
    description: 'Regenerate, sync, and audit the roadmap for an existing repository.',
    classicCliExample: 'roadmapsmith maintain',
    slashExamples: ['/maintain', '/road maintain', '/roadmap-sync maintain'],
    taskLabel: 'RoadmapSmith: Maintain'
  },
  {
    id: 'status',
    description: 'Inspect CLI, roadmap, VS Code task, and Claude hook readiness.',
    classicCliExample: 'roadmapsmith doctor --json',
    slashExamples: ['/status', '/road status', '/roadmap-sync status'],
    taskLabel: 'RoadmapSmith: Status'
  },
  {
    id: 'init',
    description: 'Create ROADMAP.md and AGENTS.md when they are missing.',
    classicCliExample: 'roadmapsmith init',
    slashExamples: ['/init', '/road init', '/roadmap-sync init'],
    taskLabel: 'RoadmapSmith: Init'
  },
  {
    id: 'generate',
    description: 'Rebuild the managed roadmap block from repository context.',
    classicCliExample: 'roadmapsmith generate --project-root .',
    slashExamples: ['/generate', '/road generate', '/roadmap-sync generate'],
    taskLabel: 'RoadmapSmith: Generate'
  },
  {
    id: 'validate',
    description: 'Inspect per-task evidence status as JSON.',
    classicCliExample: 'roadmapsmith validate --json --project-root .',
    slashExamples: ['/validate', '/road validate', '/roadmap-sync validate'],
    taskLabel: 'RoadmapSmith: Validate'
  },
  {
    id: 'sync',
    description: 'Apply evidence-backed checklist sync to ROADMAP.md.',
    classicCliExample: 'roadmapsmith sync --project-root .',
    slashExamples: ['/sync', '/road sync', '/roadmap-sync sync'],
    taskLabel: 'RoadmapSmith: Sync'
  },
  {
    id: 'audit',
    description: 'Run sync and print the post-sync mismatch summary.',
    classicCliExample: 'roadmapsmith sync --audit --project-root .',
    slashExamples: ['/audit', '/road audit', '/roadmap-sync audit'],
    taskLabel: 'RoadmapSmith: Sync Audit'
  },
  {
    id: 'setup',
    description: 'Generate visible VS Code tasks and optional Claude hook wiring.',
    classicCliExample: 'roadmapsmith setup',
    slashExamples: ['/setup', '/road setup', '/roadmap-sync setup'],
    taskLabel: 'RoadmapSmith: Refresh Setup'
  }
];

const SLASH_ROOT_ALIASES = new Set(['/road', '/roadmap-sync']);

const DIRECT_SLASH_ALIAS_TO_ACTION = Object.freeze({
  '/zero': 'zero',
  '/maintain': 'maintain',
  '/status': 'status',
  '/init': 'init',
  '/generate': 'generate',
  '/validate': 'validate',
  '/sync': 'sync',
  '/audit': 'audit',
  '/setup': 'setup'
});

function normalizeActionId(value) {
  return String(value || '').trim().toLowerCase().replace(/^\/+/, '');
}

function isSlashToken(value) {
  return typeof value === 'string' && value.trim().startsWith('/');
}

function getSlashAction(actionId) {
  const normalized = normalizeActionId(actionId);
  return SLASH_ACTIONS.find((action) => action.id === normalized) || null;
}

function getSlashActionSpecs() {
  return SLASH_ACTIONS.map((action) => ({ ...action }));
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

  return [...startsWithMatches, ...containsMatches].map((action) => ({ ...action }));
}

function resolveSlashInvocation(command, args = []) {
  if (!isSlashToken(command)) {
    return null;
  }

  const normalizedCommand = String(command).trim().toLowerCase();

  if (Object.prototype.hasOwnProperty.call(DIRECT_SLASH_ALIAS_TO_ACTION, normalizedCommand)) {
    return {
      kind: 'execute',
      actionId: DIRECT_SLASH_ALIAS_TO_ACTION[normalizedCommand],
      query: normalizeActionId(normalizedCommand),
      source: normalizedCommand,
      suggestions: getSlashSuggestions(normalizedCommand)
    };
  }

  if (SLASH_ROOT_ALIASES.has(normalizedCommand)) {
    const queryToken = args.length > 0 ? normalizeActionId(args[0]) : '';
    if (!queryToken) {
      return {
        kind: 'palette',
        query: '',
        source: normalizedCommand,
        suggestions: getSlashSuggestions('')
      };
    }

    const exactAction = getSlashAction(queryToken);
    if (exactAction) {
      return {
        kind: 'execute',
        actionId: exactAction.id,
        query: queryToken,
        source: normalizedCommand,
        suggestions: getSlashSuggestions(queryToken)
      };
    }

    return {
      kind: 'palette',
      query: queryToken,
      source: normalizedCommand,
      suggestions: getSlashSuggestions(queryToken)
    };
  }

  return {
    kind: 'palette',
    query: normalizeActionId(normalizedCommand),
    source: normalizedCommand,
    suggestions: getSlashSuggestions(normalizedCommand)
  };
}

function renderSlashPalette(options = {}) {
  const source = options.source || '/road';
  const query = normalizeActionId(options.query);
  const suggestions = Array.isArray(options.suggestions) ? options.suggestions : getSlashSuggestions(query);
  const lines = [];

  lines.push('RoadmapSmith slash palette');
  lines.push('');

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
      lines.push(`- /${action.id}: ${action.description}`);
      lines.push(`  Classic CLI: ${action.classicCliExample}`);
      lines.push(`  Skill form: /roadmap-sync ${action.id}`);
      lines.push(`  VS Code task: ${action.taskLabel}`);
    });
  }

  lines.push('');
  lines.push('Examples:');
  lines.push('- roadmapsmith zero');
  lines.push('- roadmapsmith maintain');
  lines.push('- roadmapsmith /road');
  lines.push('- roadmapsmith /maintain');
  lines.push('- roadmapsmith /roadmap-sync maintain');
  lines.push('');
  lines.push('Installing the skill alone does not expose CLI behavior in VS Code. Use roadmapsmith setup for the visible task/launcher layer.');

  return lines.join('\n');
}

module.exports = {
  DIRECT_SLASH_ALIAS_TO_ACTION,
  SLASH_ROOT_ALIASES,
  getSlashAction,
  getSlashActionSpecs,
  getSlashSuggestions,
  isSlashToken,
  normalizeActionId,
  renderSlashPalette,
  resolveSlashInvocation
};
