'use strict';

const fs = require('fs');
const path = require('path');
const { walkFiles, detectLanguages, detectTestFrameworks } = require('../io');
const { createRoadmapModel, PHASE_ORDER } = require('../model');
const { slugify, ensureTrailingNewline } = require('../utils');
const { parseRoadmap, upsertManagedBlock } = require('../parser');
const { findBestTaskMatch, dedupeTasks } = require('../match');
const { collectPluginContributions } = require('../config');
const { renderBody } = require('../renderer');

function detectModules(files) {
  const modules = new Set();
  const roots = ['src/', 'apps/', 'packages/', 'lib/', 'cmd/', 'internal/'];

  for (const file of files) {
    const root = roots.find((candidate) => file.startsWith(candidate));
    if (!root) {
      continue;
    }
    const relative = file.slice(root.length);
    const first = relative.split('/')[0];
    if (!first || first.includes('.')) {
      continue;
    }
    modules.add(first);
  }

  return Array.from(modules).sort((left, right) => left.localeCompare(right));
}

function detectCommands(files) {
  const commands = new Set();
  for (const file of files) {
    if (file.startsWith('bin/')) {
      commands.add(path.basename(file, path.extname(file)));
    }
    if (file.startsWith('cmd/')) {
      commands.add(file.split('/')[1] || file);
    }
  }
  return Array.from(commands).sort((left, right) => left.localeCompare(right));
}

function collectTodoHints(projectRoot, files) {
  const hints = [];
  const relevant = files.filter((file) => /\.(js|ts|tsx|py|go|rs|md)$/.test(file)).slice(0, 120);

  for (const file of relevant) {
    const absolutePath = path.resolve(projectRoot, file);
    let content = '';
    try {
      content = fs.readFileSync(absolutePath, 'utf8');
    } catch {
      continue;
    }

    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      if (/TODO|FIXME/i.test(lines[i])) {
        hints.push({
          file,
          line: i + 1,
          text: lines[i].trim()
        });
      }
      if (hints.length >= 12) {
        return hints;
      }
    }
  }

  return hints;
}

function collectCodeTodoHints(projectRoot, files) {
  const hints = [];
  const codeFiles = files.filter((file) => /\.(js|ts|tsx|py|go|rs)$/.test(file)).slice(0, 120);

  for (const file of codeFiles) {
    const absolutePath = path.resolve(projectRoot, file);
    let content = '';
    try {
      content = fs.readFileSync(absolutePath, 'utf8');
    } catch {
      continue;
    }

    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      if (/TODO|FIXME/i.test(lines[i])) {
        hints.push({
          file,
          line: i + 1,
          text: lines[i].trim()
        });
      }
      if (hints.length >= 6) {
        return hints;
      }
    }
  }

  return hints;
}

function scanProject(projectRoot) {
  const files = walkFiles(projectRoot);
  const languages = detectLanguages(files);
  const testFrameworks = detectTestFrameworks(projectRoot, files);
  const modules = detectModules(files);
  const commands = detectCommands(files);
  const todos = collectTodoHints(projectRoot, files);
  const codeTodos = collectCodeTodoHints(projectRoot, files);

  const implementedFiles = files.filter((file) => /\.(js|ts|tsx|py|go|rs|java|kt|cs)$/.test(file));
  const testFiles = files.filter((file) => /(^|\/)(__tests__|tests)\//.test(file) || /\.test\.|\.spec\.|_test\.go$/.test(file));

  return {
    projectRoot,
    files,
    languages,
    testFrameworks,
    modules,
    commands,
    todos,
    codeTodos,
    implementedCount: implementedFiles.length,
    testCount: testFiles.length
  };
}

function toCandidate(text, phase, priority, source = 'default') {
  return {
    id: slugify(`${phase}-${text}`),
    text,
    phase,
    priority,
    checked: false,
    source
  };
}

function buildDefaultCandidates(scan, config) {
  const languageLabel = scan.languages.length > 0 ? scan.languages.join(', ') : 'current stack';
  const candidates = [];

  const p0 = [
    ...config.phaseTemplates.P0,
    `Document measurable north star metrics for ${languageLabel}`,
    'Close critical TODO and FIXME items blocking release confidence'
  ];

  if (scan.testFrameworks.length === 0) {
    p0.push(`Add automated test harness for ${languageLabel}`);
  }

  for (const item of p0) {
    candidates.push(toCandidate(item, 'P0', 'P0'));
  }

  const p1 = [
    ...config.phaseTemplates.P1,
    'Expand feature-level validation and regression checks'
  ];

  for (const moduleName of scan.modules.slice(0, 5)) {
    p1.push(`Finalize module implementation: ${moduleName}`);
  }

  for (const commandName of scan.commands.slice(0, 5)) {
    p1.push(`Harden command behavior and error handling: ${commandName}`);
  }

  for (const item of p1) {
    candidates.push(toCandidate(item, 'P1', 'P1'));
  }

  const p2 = [
    ...config.phaseTemplates.P2,
    'Complete release candidate checklist and production readiness review'
  ];

  for (const item of p2) {
    candidates.push(toCandidate(item, 'P2', 'P2'));
  }

  for (const hint of scan.todos.slice(0, 5)) {
    candidates.push(toCandidate(`Resolve backlog note in ${hint.file}`, 'P0', 'P0', 'todo-hint'));
  }

  return candidates;
}

function applyTaskMatchers(scan, config) {
  const candidates = [];
  for (const matcher of config.taskMatchers || []) {
    if (!matcher || !matcher.pattern || !matcher.task) {
      continue;
    }

    const regex = new RegExp(matcher.pattern, 'i');
    if (!scan.files.some((file) => regex.test(file))) {
      continue;
    }

    const phase = matcher.phase || matcher.priority || 'P1';
    const priority = matcher.priority || phase;
    candidates.push(toCandidate(matcher.task, phase, priority, 'task-matcher'));
  }
  return candidates;
}

function inferPhase(existingTask) {
  const section = String(existingTask.section || '').toUpperCase();
  if (section.includes('P0')) return 'P0';
  if (section.includes('P1')) return 'P1';
  if (section.includes('P2')) return 'P2';
  return 'P1';
}

function mergeWithExisting(candidates, existingTasks) {
  const matchedExistingIds = new Set();
  const merged = [];

  for (const candidate of candidates) {
    const match = findBestTaskMatch(candidate, existingTasks);
    if (match) {
      matchedExistingIds.add(match.task.id);
      merged.push({
        ...candidate,
        id: match.task.id,
        checked: match.task.checked
      });
      continue;
    }

    merged.push(candidate);
  }

  for (const existing of existingTasks) {
    if (matchedExistingIds.has(existing.id)) {
      continue;
    }

    const phase = inferPhase(existing);
    merged.push({
      id: existing.id,
      text: existing.text,
      phase,
      priority: phase,
      checked: existing.checked,
      source: 'existing'
    });
  }

  return dedupeTasks(merged);
}

function groupByPhase(tasks) {
  const groups = { P0: [], P1: [], P2: [] };
  for (const task of tasks) {
    const phase = PHASE_ORDER.includes(task.phase) ? task.phase : 'P2';
    groups[phase].push(task);
  }

  for (const phase of PHASE_ORDER) {
    groups[phase].sort((left, right) => left.text.localeCompare(right.text));
  }

  return groups;
}

function taskLine(task) {
  return `- [${task.checked ? 'x' : ' '}] ${task.text} <!-- rs:task=${task.id} -->`;
}

function checkedState(model, id) {
  return Boolean(model.checkedById && model.checkedById[id]);
}

function renderManagedBody(model) {
  const lines = [];

  lines.push('# Project Roadmap');
  lines.push('');
  lines.push('## Product North Star');
  lines.push(model.northStar);
  lines.push('');

  lines.push('## Current State');
  lines.push(`- Implemented surface: ${model.currentState.implementedSummary}`);
  lines.push(`- TODO surface: ${model.currentState.todoSummary}`);
  lines.push(`- Detected stacks: ${model.currentState.stackSummary}`);
  lines.push('');

  lines.push('## Phased Roadmap');
  lines.push('');
  lines.push('### Phase P0 (Critical)');
  for (const task of model.phases.P0) {
    lines.push(taskLine(task));
  }
  lines.push('');
  lines.push('### Phase P1 (Important)');
  for (const task of model.phases.P1) {
    lines.push(taskLine(task));
  }
  lines.push('');
  lines.push('### Phase P2 (Optimization)');
  for (const task of model.phases.P2) {
    lines.push(taskLine(task));
  }
  lines.push('');

  lines.push('## Release Milestones');
  for (const milestone of model.milestones) {
    const id = `milestone-${slugify(milestone.version)}`;
    lines.push(`- [${checkedState(model, id) ? 'x' : ' '}] ${milestone.version}: ${milestone.goal} <!-- rs:task=${id} -->`);
  }
  lines.push('');

  lines.push('## Command/Module Breakdown');
  if (model.commandBreakdown.length === 0) {
    const id = 'identify-command-module-boundaries';
    lines.push(`- [${checkedState(model, id) ? 'x' : ' '}] Identify command/module boundaries for the next increment <!-- rs:task=${id} -->`);
  } else {
    for (const item of model.commandBreakdown) {
      const id = `module-${slugify(item)}`;
      lines.push(`- [${checkedState(model, id) ? 'x' : ' '}] ${item} <!-- rs:task=${id} -->`);
    }
  }
  lines.push('');

  lines.push('## Exit Criteria Per Phase');
  for (const item of model.exitCriteria) {
    const id = `exit-${slugify(item)}`;
    lines.push(`- [${checkedState(model, id) ? 'x' : ' '}] ${item} <!-- rs:task=${id} -->`);
  }
  lines.push('');

  for (const section of model.customSections) {
    lines.push(`## ${section.title}`);
    for (const line of section.items) {
      lines.push(line);
    }
    lines.push('');
  }

  lines.push('## Risks and Anti-goals');
  lines.push('### Risks');
  for (const risk of model.risks) {
    const id = `risk-${slugify(risk)}`;
    lines.push(`- [${checkedState(model, id) ? 'x' : ' '}] ${risk} <!-- rs:task=${id} -->`);
  }
  lines.push('');
  lines.push('### Anti-goals');
  for (const antiGoal of model.antiGoals) {
    const id = `anti-goal-${slugify(antiGoal)}`;
    lines.push(`- [${checkedState(model, id) ? 'x' : ' '}] ${antiGoal} <!-- rs:task=${id} -->`);
  }

  return ensureTrailingNewline(lines.join('\n')).trimEnd();
}

function inferProjectName(projectRoot) {
  const pkgPath = path.join(projectRoot, 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkg.name) return pkg.name;
  } catch {
    // ignore — try other manifests
  }
  return path.basename(projectRoot);
}

function buildPhasesDetailed(phases, config) {
  const configPhases = config.product && Array.isArray(config.product.phases)
    ? config.product.phases : [];
  if (configPhases.length > 0) return configPhases;

  return [
    {
      phaseNumber: 1,
      title: 'Foundation Baseline',
      priority: 'P0',
      objective: 'Establish a stable, testable baseline that unblocks all downstream delivery.',
      steps: [{
        stepNumber: 1,
        title: 'Core Implementation',
        priority: 'P0',
        dependsOn: [],
        objective: 'Close critical path items.',
        tasks: phases.P0,
        exitCriteria: [
          { text: 'All P0 tasks validated by evidence', priority: 'P0' },
          { text: 'CI is green on main', priority: 'P0' }
        ],
        risks: []
      }]
    },
    {
      phaseNumber: 2,
      title: 'Feature Completeness',
      priority: 'P1',
      objective: 'Expand functionality and reduce operational risk.',
      steps: [{
        stepNumber: 1,
        title: 'Feature Delivery',
        priority: 'P1',
        dependsOn: [1],
        objective: 'Deliver planned P1 features.',
        tasks: phases.P1,
        exitCriteria: [
          { text: 'All P1 tasks validated by evidence', priority: 'P1' },
          { text: 'No regressions on Phase 1 functionality', priority: 'P0' }
        ],
        risks: []
      }]
    },
    {
      phaseNumber: 3,
      title: 'Release Hardening',
      priority: 'P2',
      objective: 'Complete hardening and production readiness for v1.0.',
      steps: [{
        stepNumber: 1,
        title: 'Hardening',
        priority: 'P2',
        dependsOn: [2],
        objective: 'Close P2 items and harden release.',
        tasks: phases.P2,
        exitCriteria: [
          { text: 'All P2 tasks validated by evidence', priority: 'P2' },
          { text: 'Release candidate checklist complete', priority: 'P0' }
        ],
        risks: []
      }]
    }
  ];
}

function buildSteps(phases, config) {
  const configSteps = config.product && Array.isArray(config.product.steps) ? config.product.steps : [];
  if (configSteps.length > 0) return configSteps;

  const stepDefs = [
    { stepNumber: 1, title: 'Foundation Baseline', priority: 'P0', dependsOn: [], phaseKey: 'P0',
      objective: 'Establish a stable, testable baseline that unblocks all downstream delivery.' },
    { stepNumber: 2, title: 'Feature Completeness', priority: 'P1', dependsOn: [1], phaseKey: 'P1',
      objective: 'Expand functionality, improve reliability, and reduce operational risk.' },
    { stepNumber: 3, title: 'Release Hardening', priority: 'P2', dependsOn: [2], phaseKey: 'P2',
      objective: 'Complete hardening, final validation, and production readiness for v1.0.' }
  ];

  const defaultExitCriteria = {
    1: ['All P0 tasks validated by evidence', 'CI is green on main'],
    2: ['All P1 tasks validated by evidence', 'No regressions on P0 functionality'],
    3: ['All P2 tasks validated by evidence', 'Release candidate checklist complete']
  };

  return stepDefs.map((def) => ({
    stepNumber: def.stepNumber,
    title: def.title,
    priority: def.priority,
    dependsOn: def.dependsOn,
    objective: def.objective,
    deliverables: phases[def.phaseKey] || [],
    exitCriteria: defaultExitCriteria[def.stepNumber] || [],
    risks: []
  }));
}

function createModel(scan, tasks, config, customSections, checkedById) {
  const phases = groupByPhase(tasks);

  const implemented = [
    `${scan.implementedCount} implementation files across ${scan.languages.join(', ') || 'detected stack'}`
  ];

  const scaffold = scan.modules.length > 0
    ? scan.modules.slice(0, 6).map((m) => `Module "${m}" partially implemented — coverage unknown`)
    : [];

  const knownLimitations = (scan.codeTodos || []).slice(0, 6).map((t) => `${t.file}:${t.line} — ${t.text.slice(0, 80)}`);

  const currentState = {
    implemented,
    scaffold,
    knownLimitations,
    implementedSummary: `${scan.implementedCount} implementation files detected`,
    todoSummary: `${scan.todos.length} TODO/FIXME markers detected`,
    stackSummary: scan.languages.length > 0 ? scan.languages.join(', ') : 'No language-specific stack detected'
  };

  const exitCriteria = [
    'P0: all critical checklist items validated by code/test/artifact evidence',
    'P1: reliability and regression checks green on the mainline',
    'P2: release hardening and anti-goal checks completed for v1.0'
  ];

  const commandBreakdown = [];
  for (const moduleName of scan.modules.slice(0, 8)) {
    commandBreakdown.push(`Module: ${moduleName}`);
  }
  for (const command of scan.commands.slice(0, 8)) {
    commandBreakdown.push(`Command: ${command}`);
  }

  const productConfig = config.product || {};
  const inferredName = inferProjectName(scan.projectRoot || process.cwd());
  const product = {
    name: productConfig.name || inferredName,
    northStar: productConfig.northStar || '',
    positioning: productConfig.positioning || '',
    primaryUser: productConfig.primaryUser || '',
    targetOutcome: productConfig.targetOutcome || ''
  };

  const defaultRisks = [
    'Roadmap drift if checklist state diverges from repository evidence',
    'Silent regressions when tasks are marked complete without tests',
    'Scope creep that delays the v1.0 milestone path'
  ];
  const defaultAntiGoals = [
    'Do not mark tasks complete without repository evidence',
    'Do not introduce non-deterministic roadmap formatting',
    'Do not hide validation failures from roadmap consumers'
  ];

  const risks = (productConfig.risks && productConfig.risks.length > 0) ? productConfig.risks : defaultRisks;
  const antiGoals = (productConfig.antiGoals && productConfig.antiGoals.length > 0) ? productConfig.antiGoals : defaultAntiGoals;
  const successCriteria = productConfig.successCriteria || [];

  const northStar = productConfig.northStar
    || 'Ship validated, high-impact increments with deterministic delivery and transparent completion evidence.';

  const steps = buildSteps(phases, config);
  const phasesDetailed = buildPhasesDetailed(phases, config);

  return createRoadmapModel({
    northStar,
    product,
    currentState,
    phases,
    steps,
    phasesDetailed,
    milestones: config.milestones,
    commandBreakdown,
    exitCriteria,
    risks,
    antiGoals,
    successCriteria,
    customSections,
    checkedById
  });
}

function normalizeCandidate(candidate) {
  const phase = candidate.phase || candidate.priority || 'P1';
  const priority = candidate.priority || phase;
  return {
    id: candidate.id || slugify(`${phase}-${candidate.text}`),
    text: candidate.text,
    phase,
    priority,
    checked: Boolean(candidate.checked),
    source: candidate.source || 'plugin'
  };
}

function generateRoadmapDocument(options) {
  const projectRoot = options.projectRoot;
  const config = options.config;
  const plugins = options.plugins || [];
  const existingContent = options.existingContent || '';

  const scan = scanProject(projectRoot);
  const existing = parseRoadmap(existingContent);
  const existingCheckedById = {};
  for (const task of existing.tasks) {
    existingCheckedById[task.id] = task.checked;
  }
  const existingPhaseTasks = existing.tasks.filter((task) => /^Phase P[0-2]/i.test(String(task.section || '')));

  const pluginTaskCandidates = collectPluginContributions(plugins, 'registerTaskDetectors', {
    projectRoot,
    config,
    scan
  }).map(normalizeCandidate);

  const pluginSections = collectPluginContributions(plugins, 'registerSectionGenerators', {
    projectRoot,
    config,
    scan
  }).map((section) => ({
    title: section.title,
    items: section.items || []
  }));

  const configSections = (config.customSections || []).map((section) => ({
    title: section.title,
    items: section.items || []
  }));

  const baseCandidates = buildDefaultCandidates(scan, config);
  const matcherCandidates = applyTaskMatchers(scan, config);
  const merged = mergeWithExisting([...baseCandidates, ...matcherCandidates, ...pluginTaskCandidates], existingPhaseTasks);
  const model = createModel(scan, merged, config, [...configSections, ...pluginSections], existingCheckedById);
  const profile = config.roadmapProfile || 'compact';
  const managedBody = renderBody(model, profile);

  return upsertManagedBlock(existingContent, managedBody);
}

module.exports = {
  generateRoadmapDocument,
  renderManagedBody,
  scanProject
};
