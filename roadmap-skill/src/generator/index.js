'use strict';

const fs = require('fs');
const path = require('path');
const { walkFiles, detectLanguages, detectTestFrameworks, detectWorkspaces } = require('../io');
const { createRoadmapModel, PHASE_ORDER } = require('../model');
const { slugify } = require('../utils');
const { parseRoadmap, tasksInManagedBlock, upsertManagedBlock } = require('../parser');
const { findBestTaskMatch, dedupeTasks } = require('../match');
const { collectPluginContributions } = require('../config');
const { renderBody } = require('../renderer');
const { classifyProject } = require('../classifier');

const IMPL_PATTERN_RE = /[/|]TODO|TODO[|/]|[/|]FIXME|FIXME[|/]/;
const COMMENT_TODO_RE = /(?:\/\/|#|\*\s*).*\b(?:TODO|FIXME)\b/;
const ADDITIONS_SECTION_TITLE = 'RoadmapSmith Additions';
const PHASE_LABEL_RE = /`?\[(P[0-2])\]`?/i;

function isTodoMarker(line) {
  return COMMENT_TODO_RE.test(line) && !IMPL_PATTERN_RE.test(line);
}

const GENERIC_MODULE_NAMES = new Set(['index', 'main', 'utils', 'common', 'helpers', 'types', 'constants', 'model']);

function detectModules(files) {
  const modules = new Set();
  const rootPrefixes = ['src/', 'apps/', 'packages/', 'lib/', 'cmd/', 'internal/'];

  for (const file of files) {
    let relative;

    const directRoot = rootPrefixes.find((r) => file.startsWith(r));
    if (directRoot) {
      relative = file.slice(directRoot.length);
    } else {
      let found = false;
      for (const r of rootPrefixes) {
        const idx = file.indexOf('/' + r);
        if (idx !== -1) {
          // Only accept nested prefix when it appears within the first two path segments
          // (e.g. "wrapper/src/..." is fine; "a/b/c/src/..." is too deep and likely a fixture or dependency)
          if (file.slice(0, idx).split('/').length > 2) continue;
          relative = file.slice(idx + 1 + r.length);
          found = true;
          break;
        }
      }
      if (!found) continue;
    }

    const first = relative.split('/')[0];
    if (!first) continue;

    if (first.includes('.')) {
      const name = first.slice(0, first.lastIndexOf('.'));
      if (name && !GENERIC_MODULE_NAMES.has(name)) {
        modules.add(name);
      }
    } else {
      modules.add(first);
    }
  }

  for (const file of files) {
    const parts = file.split('/');
    if (parts.length === 2 && parts[1] === '__init__.py' && parts[0] && !GENERIC_MODULE_NAMES.has(parts[0])) {
      modules.add(parts[0]);
    }
  }

  return Array.from(modules).sort((left, right) => left.localeCompare(right));
}

function detectCommands(files, projectRoot) {
  const commands = new Set();
  for (const file of files) {
    if (file.startsWith('bin/')) {
      commands.add(path.basename(file, path.extname(file)));
    }
    if (file.startsWith('cmd/')) {
      commands.add(file.split('/')[1] || file);
    }
  }
  if (projectRoot) {
    let pkgContent = null;
    try {
      pkgContent = fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8');
    } catch (err) {
      if (err.code !== 'ENOENT') {
        process.stderr.write(`roadmapsmith: failed to read package.json: ${err.message}\n`);
      }
    }
    if (pkgContent) {
      try {
        const pkg = JSON.parse(pkgContent);
        if (pkg.bin) {
          const binNames = typeof pkg.bin === 'string'
            ? [path.basename(projectRoot)]
            : Object.keys(pkg.bin);
          for (const name of binNames) commands.add(name);
        }
      } catch (err) {
        process.stderr.write(`roadmapsmith: failed to parse package.json: ${err.message}\n`);
      }
    }
    let tomlContent = null;
    try {
      tomlContent = fs.readFileSync(path.join(projectRoot, 'pyproject.toml'), 'utf8');
    } catch (err) {
      if (err.code !== 'ENOENT') {
        process.stderr.write(`roadmapsmith: failed to read pyproject.toml: ${err.message}\n`);
      }
    }
    if (tomlContent) {
      for (const sectionMatch of tomlContent.matchAll(/\[(?:project\.scripts|tool\.poetry\.scripts)\]([\s\S]*?)(?:\n\[|$)/g)) {
        for (const entryMatch of sectionMatch[1].matchAll(/^([\w-]+)\s*=/gm)) {
          commands.add(entryMatch[1]);
        }
      }
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
      if (isTodoMarker(lines[i])) {
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
      if (isTodoMarker(lines[i])) {
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
  const commands = detectCommands(files, projectRoot);
  const todos = collectTodoHints(projectRoot, files);
  const codeTodos = collectCodeTodoHints(projectRoot, files);
  const workspaces = detectWorkspaces(projectRoot, files);

  const implementedFiles = files.filter((file) => /\.(js|ts|tsx|py|go|rs|java|kt|cs)$/.test(file));
  const testFiles = files.filter((file) => /(^|\/)(__tests__|tests)\//.test(file) || /\.test\.|\.spec\.|_test\.go$/.test(file));

  const classifier = classifyProject({ projectRoot, files });

  return {
    projectRoot,
    files,
    languages,
    testFrameworks,
    modules,
    commands,
    todos,
    codeTodos,
    workspaces,
    implementedCount: implementedFiles.length,
    testCount: testFiles.length,
    projectType: classifier.type,
    classifierConfidence: classifier.confidence,
    classifierSignals: classifier.signals
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

function buildDoneCriteriaCandidates(zeroModeConfig) {
  if (!Array.isArray(zeroModeConfig.doneCriteria) || zeroModeConfig.doneCriteria.length === 0) {
    return [];
  }
  return zeroModeConfig.doneCriteria.map((criterion) => {
    const phaseMatch = String(criterion).match(/^\s*\[(P[0-2])\]\s*/i);
    const phase = phaseMatch ? phaseMatch[1].toUpperCase() : 'P0';
    const text = phaseMatch ? criterion.slice(phaseMatch[0].length).trim() : criterion;
    return {
      id: slugify(`zm-${text}`),
      text,
      phase,
      priority: phase,
      checked: false,
      source: 'doneCriteria'
    };
  });
}

function hasSubstantiveManagedBlock(parsedRoadmap) {
  if (!parsedRoadmap || !parsedRoadmap.managedRange) {
    return false;
  }

  const managedLines = parsedRoadmap.lines.slice(
    parsedRoadmap.managedRange.start + 1,
    parsedRoadmap.managedRange.end
  );
  return managedLines.some((line) => line.trim().length > 0);
}

function stripTrailingBlankLines(lines) {
  const next = Array.isArray(lines) ? lines.slice() : [];
  while (next.length > 0 && !next[next.length - 1].trim()) {
    next.pop();
  }
  return next;
}

function renderAdditionTask(task, planned = false) {
  const flag = planned ? ' planned' : '';
  return `- [ ] ${task.text} <!-- rs:task=${task.id}${flag} -->`;
}

function isGenericPreserveModeCandidate(candidate) {
  return candidate && ['default', 'classifier', 'todo-hint'].includes(candidate.source);
}

function buildManagedAdditionsLines(tasks, options = {}) {
  const groups = groupByPhase(tasks);
  const lines = [];
  const includeSectionHeading = options.includeSectionHeading !== false;
  const plannedById = options.plannedById || {};

  if (includeSectionHeading) {
    lines.push(`## ${ADDITIONS_SECTION_TITLE}`);
    lines.push('');
  }

  for (const phase of PHASE_ORDER) {
    if (!groups[phase] || groups[phase].length === 0) {
      continue;
    }
    lines.push(`### Phase ${phase}`);
    for (const task of groups[phase]) {
      lines.push(renderAdditionTask(task, Boolean(plannedById[task.id])));
    }
    lines.push('');
  }

  return stripTrailingBlankLines(lines);
}

const WEB_CANDIDATES_COMMON = [
  { text: 'Add SEO metadata: title, description, and canonical URL for all pages', phase: 'P0' },
  { text: 'Implement responsive and mobile-first layout across all breakpoints', phase: 'P0' },
  { text: 'Establish accessibility baseline (semantic HTML, ARIA labels, keyboard navigation)', phase: 'P0' },
  { text: 'Add OpenGraph and Twitter card metadata for social sharing', phase: 'P1' },
  { text: 'Achieve Lighthouse performance score ≥ 90 and resolve critical findings', phase: 'P1' },
  { text: 'Validate branding consistency: typography, color tokens, and logo usage', phase: 'P1' },
  { text: 'Configure deployment and hosting pipeline (CI/CD to production)', phase: 'P2' },
  { text: 'Add web security headers: Content-Security-Policy, X-Frame-Options, HSTS', phase: 'P2' }
];

const LANDING_CANDIDATES = [
  { text: 'Complete services and content sections with clear value proposition', phase: 'P1' },
  { text: 'Implement contact form and conversion flow with input validation', phase: 'P1' },
  { text: 'Set up analytics and conversion event tracking', phase: 'P2' }
];

function buildWebCandidates(scan) {
  const candidates = WEB_CANDIDATES_COMMON.map(({ text, phase }) =>
    toCandidate(text, phase, phase, 'classifier')
  );
  if (scan.projectType === 'landing-site') {
    for (const { text, phase } of LANDING_CANDIDATES) {
      candidates.push(toCandidate(text, phase, phase, 'classifier'));
    }
  }
  return candidates;
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

  if (scan.projectType === 'frontend-web' || scan.projectType === 'landing-site') {
    candidates.push(...buildWebCandidates(scan));
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
  const textPhaseMatch = String(existingTask.text || '').match(PHASE_LABEL_RE);
  if (textPhaseMatch) return textPhaseMatch[1].toUpperCase();

  const section = String(existingTask.section || '').toUpperCase();
  if (section.includes('P0')) return 'P0';
  if (section.includes('P1')) return 'P1';
  if (section.includes('P2')) return 'P2';
  return 'P1';
}

function sortTasksByPhaseAndText(tasks) {
  return tasks.slice().sort((left, right) => {
    const leftPhaseIndex = PHASE_ORDER.indexOf(left.phase);
    const rightPhaseIndex = PHASE_ORDER.indexOf(right.phase);
    if (leftPhaseIndex !== rightPhaseIndex) {
      return leftPhaseIndex - rightPhaseIndex;
    }
    return left.text.localeCompare(right.text);
  });
}

function findPhaseSectionRange(lines, managedRange, phase) {
  const headingPattern = /^(#{2,4})\s+(.*)$/;
  const phasePattern = new RegExp(`\\b${phase}\\b`, 'i');
  let sectionStart = -1;
  let sectionLevel = 0;

  for (let index = managedRange.start + 1; index < managedRange.end; index += 1) {
    const match = lines[index].trim().match(headingPattern);
    if (!match) {
      continue;
    }
    if (!phasePattern.test(match[2])) {
      continue;
    }
    sectionStart = index;
    sectionLevel = match[1].length;
  }

  if (sectionStart < 0) {
    return null;
  }

  let sectionEnd = managedRange.end;
  for (let index = sectionStart + 1; index < managedRange.end; index += 1) {
    const match = lines[index].trim().match(headingPattern);
    if (!match) {
      continue;
    }
    if (match[1].length <= sectionLevel) {
      sectionEnd = index;
      break;
    }
  }

  return {
    start: sectionStart,
    end: sectionEnd
  };
}

function buildPreserveModeInsertions(parsedRoadmap, tasks, plannedById = {}) {
  const managedTasks = sortTasksByPhaseAndText(tasksInManagedBlock(parsedRoadmap));
  const groups = groupByPhase(tasks);
  const lines = parsedRoadmap.lines;
  const insertions = [];
  const fallbackTasks = [];
  const renderTask = (t) => renderAdditionTask(t, Boolean(plannedById[t.id]));

  for (const phase of PHASE_ORDER) {
    const phaseTasks = sortTasksByPhaseAndText(groups[phase] || []);
    if (phaseTasks.length === 0) {
      continue;
    }

    const samePhaseTasks = managedTasks.filter((task) => inferPhase(task) === phase);
    if (samePhaseTasks.length > 0) {
      const anchor = samePhaseTasks.reduce((latest, task) => {
        if (!latest || task.lastChildLineIndex > latest.lastChildLineIndex) {
          return task;
        }
        return latest;
      }, null);
      insertions.push({
        index: anchor.lastChildLineIndex + 1,
        lines: phaseTasks.map(renderTask)
      });
      continue;
    }

    const phaseSection = findPhaseSectionRange(lines, parsedRoadmap.managedRange, phase);
    if (phaseSection) {
      let insertionIndex = phaseSection.end;
      while (insertionIndex > phaseSection.start + 1 && !lines[insertionIndex - 1].trim()) {
        insertionIndex -= 1;
      }
      insertions.push({
        index: insertionIndex,
        lines: phaseTasks.map(renderTask)
      });
      continue;
    }

    fallbackTasks.push(...phaseTasks);
  }

  if (fallbackTasks.length > 0) {
    const fallbackLines = buildManagedAdditionsLines(fallbackTasks, { includeSectionHeading: true, plannedById });
    insertions.push({
      index: parsedRoadmap.managedRange.end,
      lines: ['', ...fallbackLines]
    });
  }

  return insertions.sort((left, right) => right.index - left.index);
}

function insertPreserveModeTasks(existingContent, parsedRoadmap, tasks, plannedById = {}) {
  if (!parsedRoadmap || !parsedRoadmap.managedRange || tasks.length === 0) {
    return existingContent;
  }

  const nextLines = parsedRoadmap.lines.slice();
  const insertions = buildPreserveModeInsertions(parsedRoadmap, tasks, plannedById);
  for (const insertion of insertions) {
    nextLines.splice(insertion.index, 0, ...insertion.lines);
  }

  return nextLines.join('\n');
}

function filterPreserveModeCandidates(candidates) {
  return candidates.filter((candidate) => !isGenericPreserveModeCandidate(candidate));
}

function mergeWithExisting(candidates, existingTasks, options = {}) {
  const matchedExistingIds = new Set();
  const merged = [];

  for (const candidate of candidates) {
    const match = findBestTaskMatch(candidate, existingTasks, {
      allowFuzzy: options.allowFuzzy !== false
    });
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

  if (options.includeUnmatchedExisting) {
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

function createModel(scan, tasks, config, customSections, checkedById, plannedById = {}) {
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
    workspaces: scan.workspaces || [],
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
  const zeroModeConfig = config.zeroMode || {};
  const inferredName = inferProjectName(scan.projectRoot || process.cwd());
  const product = {
    name: productConfig.name || inferredName,
    northStar: productConfig.northStar || '',
    positioning: productConfig.positioning || (zeroModeConfig.problemStatement ? `Core problem: ${zeroModeConfig.problemStatement}` : ''),
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

  const derivedConstraintRisks = Array.isArray(zeroModeConfig.constraints)
    ? zeroModeConfig.constraints.map((constraint) => `Constraint: ${constraint}`)
    : [];
  const risks = (productConfig.risks && productConfig.risks.length > 0)
    ? productConfig.risks
    : (derivedConstraintRisks.length > 0 ? derivedConstraintRisks : defaultRisks);
  const antiGoals = (productConfig.antiGoals && productConfig.antiGoals.length > 0) ? productConfig.antiGoals : defaultAntiGoals;
  const successCriteria = (productConfig.successCriteria && productConfig.successCriteria.length > 0)
    ? productConfig.successCriteria
    : (Array.isArray(zeroModeConfig.doneCriteria) ? zeroModeConfig.doneCriteria : []);

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
    customPhases: config.customPhases || [],
    moduleMetadata: config.moduleMetadata || {},
    checkedById,
    plannedById
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
  const zeroModeConfig = config.zeroMode || {};
  const plugins = options.plugins || [];
  const existingContent = options.existingContent || '';
  const preserveManagedBlock = options.preserveManagedBlock === true;
  const forceFullRegenerate = options.forceFullRegenerate === true;

  const scan = scanProject(projectRoot);
  const existing = parseRoadmap(existingContent);
  const existingCheckedById = {};
  const existingPlannedById = {};
  for (const task of existing.tasks) {
    existingCheckedById[task.id] = task.checked;
    if (task.planned) existingPlannedById[task.id] = true;
  }
  const existingManagedTasks = tasksInManagedBlock(existing);

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

  const zeroModeBriefItems = [];
  if (zeroModeConfig.problemStatement) {
    zeroModeBriefItems.push(`- **Problem statement:** ${zeroModeConfig.problemStatement}`);
  }
  if (zeroModeConfig.preferredStack) {
    zeroModeBriefItems.push(`- **Preferred stack:** ${zeroModeConfig.preferredStack}`);
  }
  if (Array.isArray(zeroModeConfig.constraints) && zeroModeConfig.constraints.length > 0) {
    zeroModeBriefItems.push(`- **Constraints:** ${zeroModeConfig.constraints.join('; ')}`);
  }
  if (Array.isArray(zeroModeConfig.doneCriteria) && zeroModeConfig.doneCriteria.length > 0) {
    zeroModeBriefItems.push(`- **Done means:** ${zeroModeConfig.doneCriteria.join('; ')}`);
  }
  const generatedZeroModeSection = zeroModeBriefItems.length > 0 ? [{
    title: 'Zero Mode Brief',
    items: zeroModeBriefItems
  }] : [];

  const configSections = (config.customSections || []).map((section) => ({
    title: section.title,
    items: section.items || []
  }));

  const evidenceLine = scan.classifierSignals.length > 0
    ? scan.classifierSignals.slice(0, 5).join(', ')
    : 'general file scan';
  const profileSection = {
    title: 'Detected Project Profile',
    items: [
      `- **Type:** ${scan.projectType}`,
      `- **Confidence:** ${scan.classifierConfidence}`,
      `- **Evidence:** ${evidenceLine}`
    ]
  };

  const baseCandidates = buildDefaultCandidates(scan, config);
  const matcherCandidates = applyTaskMatchers(scan, config);
  const doneCriteriaCandidates = buildDoneCriteriaCandidates(zeroModeConfig);
  const allCandidates = dedupeTasks([...doneCriteriaCandidates, ...baseCandidates, ...matcherCandidates, ...pluginTaskCandidates]);

  const plannedById = { ...existingPlannedById };
  for (const candidate of doneCriteriaCandidates) {
    const isNew = !findBestTaskMatch(candidate, existingManagedTasks, { allowFuzzy: true });
    if (isNew) plannedById[candidate.id] = true;
  }

  if (hasSubstantiveManagedBlock(existing) && preserveManagedBlock && !forceFullRegenerate) {
    const unmatchedCandidates = allCandidates.filter((candidate) => {
      return !findBestTaskMatch(candidate, existingManagedTasks, {
        allowFuzzy: true,
        minScore: 0.72
      });
    });
    const preserveModeCandidates = filterPreserveModeCandidates(unmatchedCandidates);

    if (preserveModeCandidates.length === 0) {
      return existingContent;
    }

    return insertPreserveModeTasks(existingContent, existing, preserveModeCandidates, plannedById);
  }

  if (hasSubstantiveManagedBlock(existing) && !forceFullRegenerate) {
    throw new Error('Refusing to regenerate a substantive managed roadmap block. Rerun with --full-regen to replace it explicitly.');
  }

  const merged = mergeWithExisting(allCandidates, existingManagedTasks, {
    allowFuzzy: true,
    includeUnmatchedExisting: false
  });
  const model = createModel(scan, merged, config, [profileSection, ...generatedZeroModeSection, ...configSections, ...pluginSections], existingCheckedById, plannedById);
  const profile = config.roadmapProfile || 'compact';
  const managedBody = renderBody(model, profile);

  return upsertManagedBlock(existingContent, managedBody);
}

module.exports = {
  generateRoadmapDocument,
  scanProject
};
