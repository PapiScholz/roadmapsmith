'use strict';

const { slugify, ensureTrailingNewline } = require('../utils');
const { sectionHeader, checkedState, priorityLabel } = require('./helpers');

function taskLineWithPriority(task, model) {
  const pri = task.priority ? `${priorityLabel(task.priority)} ` : '';
  const id = task.id || `prof-task-${slugify(task.text || String(task))}`;
  const text = task.text || String(task);
  const checked = task.checked || checkedState(model, id);
  return `- [${checked ? 'x' : ' '}] ${pri}${text} <!-- rs:task=${id} -->`;
}

function exitLine(item, phN, stN, model) {
  const text = typeof item === 'string' ? item : item.text;
  const pri = (typeof item === 'object' && item.priority) ? `${priorityLabel(item.priority)} ` : '';
  const id = `prof-ph${phN}-st${stN}-exit-${slugify(text)}`;
  const checked = checkedState(model, id);
  return `- [${checked ? 'x' : ' '}] ${pri}${text} <!-- rs:task=${id} -->`;
}

function renderSection1NorthStar(model, lines) {
  lines.push(sectionHeader(1, 'Product North Star'));
  lines.push('');
  lines.push(model.product.northStar || model.northStar);
  lines.push('');
  if (model.product.primaryUser) {
    lines.push(`**Primary user:** ${model.product.primaryUser}`);
    lines.push('');
  }
  if (model.product.targetOutcome) {
    lines.push(`**Target outcome:** ${model.product.targetOutcome}`);
    lines.push('');
  }
}

function renderSection2Positioning(model, lines) {
  lines.push(sectionHeader(2, 'Positioning and Competitive Advantage'));
  lines.push('');
  if (model.product.positioning) {
    lines.push(model.product.positioning);
  } else {
    lines.push('_No positioning statement configured. Add `product.positioning` to roadmap-skill.config.json._');
  }
  lines.push('');
}

function renderSection3CurrentState(model, lines) {
  lines.push(sectionHeader(3, 'Explicit Current State'));
  lines.push('');

  lines.push('### Implemented');
  lines.push('');
  if (model.currentState.implemented && model.currentState.implemented.length > 0) {
    for (const item of model.currentState.implemented) {
      lines.push(`- [x] ${item} <!-- rs:task=prof-state-impl-${slugify(item)} -->`);
    }
  } else {
    lines.push(`- Detected implementation surface: ${model.currentState.implementedSummary}`);
    lines.push(`- Detected stacks: ${model.currentState.stackSummary}`);
  }
  lines.push('');

  lines.push('### Scaffold / Partial');
  lines.push('');
  if (model.currentState.scaffold && model.currentState.scaffold.length > 0) {
    for (const item of model.currentState.scaffold) {
      const id = `prof-state-scaffold-${slugify(item)}`;
      lines.push(`- [ ] ${item} <!-- rs:task=${id} -->`);
    }
  } else {
    lines.push('_No scaffold modules detected. Improve detection by adding `product.steps` to config._');
  }
  lines.push('');

  if (model.currentState.workspaces && model.currentState.workspaces.length > 0) {
    lines.push('### Workspace Packages');
    lines.push('');
    lines.push(`- Workspace packages detected: ${model.currentState.workspaces.join(', ')}`);
    lines.push('');
  }

  lines.push('### Known Limitations');
  lines.push('');
  if (model.currentState.knownLimitations && model.currentState.knownLimitations.length > 0) {
    for (const item of model.currentState.knownLimitations) {
      const id = `prof-state-limit-${slugify(item)}`;
      lines.push(`- [ ] ${item} <!-- rs:task=${id} -->`);
    }
  } else {
    lines.push(`- Code-level TODO/FIXME surface: ${model.currentState.todoSummary}`);
  }
  lines.push('');
}

function renderSection4PhasedExecution(model, lines) {
  lines.push(sectionHeader(4, 'Phased Execution Roadmap'));
  lines.push('');

  const detailedPhases = [...(model.phasesDetailed || [])].sort((a, b) => a.phaseNumber - b.phaseNumber);

  for (const phase of detailedPhases) {
    lines.push(`### Phase ${phase.phaseNumber}: ${phase.title}`);
    lines.push('');
    lines.push(`**Phase Priority:** ${priorityLabel(phase.priority)}`);
    lines.push('');
    if (phase.objective) {
      lines.push(`**Objective:** ${phase.objective}`);
      lines.push('');
    }

    const steps = [...(phase.steps || [])].sort((a, b) => a.stepNumber - b.stepNumber);
    for (const step of steps) {
      const stepLabel = `${phase.phaseNumber}.${step.stepNumber}`;
      lines.push(`#### Step ${stepLabel}: ${step.title}`);
      lines.push('');
      lines.push(`**Step Priority:** ${priorityLabel(step.priority)}`);
      const deps = step.dependsOn && step.dependsOn.length > 0
        ? step.dependsOn.map((n) => `Phase ${n}`).join(', ')
        : 'None';
      lines.push(`**Depends on:** ${deps}`);
      lines.push('');
      if (step.objective) {
        lines.push(`**Objective:** ${step.objective}`);
        lines.push('');
      }

      if (step.tasks && step.tasks.length > 0) {
        lines.push('**Tasks:**');
        lines.push('');
        for (const task of step.tasks) {
          lines.push(taskLineWithPriority(task, model));
        }
        lines.push('');
      }

      if (step.exitCriteria && step.exitCriteria.length > 0) {
        lines.push('**Exit Criteria:**');
        lines.push('');
        for (const item of step.exitCriteria) {
          lines.push(exitLine(item, phase.phaseNumber, step.stepNumber, model));
        }
        lines.push('');
      }

      if (step.risks && step.risks.length > 0) {
        lines.push(`**Notable Risks:** ${step.risks.join('; ')}`);
        lines.push('');
      }
    }
  }
}

function renderSection5Milestones(model, lines) {
  lines.push(sectionHeader(5, 'Versioned Milestones'));
  lines.push('');

  for (const milestone of model.milestones) {
    const msSlug = slugify(milestone.version);
    lines.push(`### ${milestone.version}`);
    lines.push('');
    lines.push(`**Goal:** ${milestone.goal}`);
    lines.push('');

    if (milestone.mustExist && milestone.mustExist.length > 0) {
      lines.push('**What Must Exist:**');
      lines.push('');
      for (const item of milestone.mustExist) {
        const id = `prof-ms-${msSlug}-exist-${slugify(item)}`;
        lines.push(`- [${checkedState(model, id) ? 'x' : ' '}] \`[P0]\` ${item} <!-- rs:task=${id} -->`);
      }
      lines.push('');
    }

    if (milestone.mustBeStable && milestone.mustBeStable.length > 0) {
      lines.push('**What Must Be Stable:**');
      lines.push('');
      for (const item of milestone.mustBeStable) {
        const id = `prof-ms-${msSlug}-stable-${slugify(item)}`;
        lines.push(`- [${checkedState(model, id) ? 'x' : ' '}] \`[P1]\` ${item} <!-- rs:task=${id} -->`);
      }
      lines.push('');
    }

    if (milestone.outOfScope && milestone.outOfScope.length > 0) {
      lines.push('**Intentionally Out of Scope:**');
      lines.push('');
      for (const item of milestone.outOfScope) {
        lines.push(`- ${item}`);
      }
      lines.push('');
    }

    if (!milestone.mustExist && !milestone.mustBeStable && !milestone.outOfScope) {
      const id = `prof-ms-${msSlug}`;
      lines.push(`- [${checkedState(model, id) ? 'x' : ' '}] \`[P0]\` ${milestone.version}: ${milestone.goal} <!-- rs:task=${id} -->`);
      lines.push('');
    }
  }
}

const MODULE_METADATA = {
  generator: {
    state: 'Compact and professional profiles supported; Phase→Step→Task model implemented.',
    tasks: [
      { text: 'Improve Phase→Step→Task model inference quality', priority: 'P0', id: 'prof-mat-generator-improve-phase-step-task-inference' },
      { text: 'Add scan-driven task suggestions per detected module', priority: 'P1', id: 'prof-mat-generator-scan-driven-task-suggestions' }
    ]
  },
  parser: {
    state: 'Parses managed blocks, rs:task IDs, and checked state.',
    tasks: [
      { text: 'Add parser validation for Phase→Step hierarchy markers', priority: 'P1', id: 'prof-mat-parser-phase-hierarchy-validation' },
      { text: 'Improve section boundary detection for professional format', priority: 'P1', id: 'prof-mat-parser-professional-section-detection' }
    ]
  },
  renderer: {
    state: 'Dispatcher supports compact, professional, and enterprise (error) profiles.',
    tasks: [
      { text: 'Add snapshot regression fixtures for compact and professional', priority: 'P0', id: 'prof-mat-renderer-snapshot-regression-fixtures' },
      { text: 'Harden priority label rendering for edge cases', priority: 'P1', id: 'prof-mat-renderer-priority-label-edge-cases' }
    ]
  },
  validator: {
    state: 'Evidence-based validation against file, symbol, and test presence.',
    tasks: [
      { text: 'Extend validator to verify Phase→Step→Task IDs survive sync', priority: 'P1', id: 'prof-mat-validator-phase-step-task-id-sync' },
      { text: 'Add validation coverage for professional profile task IDs', priority: 'P1', id: 'prof-mat-validator-professional-task-id-coverage' }
    ]
  },
  match: {
    state: 'Task similarity matching with edit-distance threshold.',
    tasks: [
      { text: 'Tune similarity threshold to reduce false-positive merges', priority: 'P0', id: 'prof-mat-match-tune-similarity-threshold' }
    ]
  },
  config: {
    state: 'Supports roadmapProfile, product block, milestones, phaseTemplates, plugins.',
    tasks: [
      { text: 'Add JSON schema validation for roadmap-skill.config.json', priority: 'P1', id: 'prof-mat-config-json-schema-validation' }
    ]
  },
  io: {
    state: 'Scans files, detects languages, test frameworks, commands, modules.',
    tasks: [
      { text: 'Improve module detection for monorepo workspace layouts', priority: 'P2', id: 'prof-mat-io-monorepo-workspace-detection' }
    ]
  }
};

function renderSection6MaturityPath(model, lines) {
  lines.push(sectionHeader(6, 'Command-by-Command / Module-by-Module Maturity Path'));
  lines.push('');

  const allAreas = [...model.commandBreakdown];

  if (allAreas.length === 0) {
    const id = 'prof-mat-identify-boundaries';
    lines.push(`- [${checkedState(model, id) ? 'x' : ' '}] \`[P1]\` Identify command/module boundaries for the next increment <!-- rs:task=${id} -->`);
    lines.push('');
    return;
  }

  for (const area of allAreas) {
    const rawName = area.replace(/^(Module:|Command:)\s*/i, '').trim();
    const meta = MODULE_METADATA[rawName.toLowerCase()];
    const displayName = rawName;

    lines.push(`### ${displayName}`);
    lines.push('');
    if (meta) {
      lines.push(`**Current state:** ${meta.state}`);
      lines.push('');
      for (const task of meta.tasks) {
        lines.push(`- [${checkedState(model, task.id) ? 'x' : ' '}] ${priorityLabel(task.priority)} ${task.text} <!-- rs:task=${task.id} -->`);
      }
    } else {
      const isCommand = /^Command:/i.test(area);
      const kind = isCommand ? 'command' : 'module';
      const nextId = `prof-mat-${slugify(rawName)}-define-maturity-criteria`;
      lines.push(`**Current state:** ${kind} detected in scan.`);
      lines.push('');
      lines.push(`- [${checkedState(model, nextId) ? 'x' : ' '}] \`[P1]\` Define maturity criteria and testability gates for ${displayName} <!-- rs:task=${nextId} -->`);
    }
    lines.push('');
  }
}

function renderSection7OutputContract(model, lines) {
  lines.push(sectionHeader(7, 'Output Contract Roadmap'));
  lines.push('');

  lines.push('### Output Format');
  lines.push('');
  const formatItems = [
    { text: 'Define stable public output format (stdout, files, exit codes)', priority: 'P0' },
    { text: 'Version output format alongside package version', priority: 'P1' }
  ];
  for (const item of formatItems) {
    const id = `prof-out-${slugify(item.text)}`;
    lines.push(`- [${checkedState(model, id) ? 'x' : ' '}] ${priorityLabel(item.priority)} ${item.text} <!-- rs:task=${id} -->`);
  }
  lines.push('');

  lines.push('### Breaking Changes');
  lines.push('');
  const breakingItems = [
    { text: 'Document breaking vs. non-breaking output changes', priority: 'P1' },
    { text: 'Add output schema validation to CI', priority: 'P1' }
  ];
  for (const item of breakingItems) {
    const id = `prof-out-${slugify(item.text)}`;
    lines.push(`- [${checkedState(model, id) ? 'x' : ' '}] ${priorityLabel(item.priority)} ${item.text} <!-- rs:task=${id} -->`);
  }
  lines.push('');
}

function renderSection8Testing(model, lines) {
  lines.push(sectionHeader(8, 'Testing and Quality-Gate Roadmap'));
  lines.push('');

  lines.push('### Test Coverage');
  lines.push('');
  const coverageItems = [
    { text: 'Unit test coverage for all core modules', priority: 'P0' },
    { text: 'Integration tests covering the full generate → sync → validate pipeline', priority: 'P0' },
    { text: 'Regression fixtures for compact and professional profile output', priority: 'P1' },
    { text: 'Edge case coverage: empty repo, no config, large monorepo scan', priority: 'P1' }
  ];
  for (const item of coverageItems) {
    const id = `prof-test-${slugify(item.text)}`;
    lines.push(`- [${checkedState(model, id) ? 'x' : ' '}] ${priorityLabel(item.priority)} ${item.text} <!-- rs:task=${id} -->`);
  }
  lines.push('');

  lines.push('### Quality Gates');
  lines.push('');
  const gateItems = [
    { text: 'CI quality gate: tests must pass before merge', priority: 'P0' },
    { text: 'Block merge when generated roadmap loses checked state', priority: 'P0' },
    { text: 'Add professional renderer snapshot tests', priority: 'P1' }
  ];
  for (const item of gateItems) {
    const id = `prof-test-${slugify(item.text)}`;
    lines.push(`- [${checkedState(model, id) ? 'x' : ' '}] ${priorityLabel(item.priority)} ${item.text} <!-- rs:task=${id} -->`);
  }
  lines.push('');
}

function renderSection9Distribution(model, lines) {
  lines.push(sectionHeader(9, 'Distribution Roadmap'));
  lines.push('');

  lines.push('### npm Registry');
  lines.push('');
  const npmItems = [
    { text: 'Publish to npm registry with stable semver', priority: 'P0' },
    { text: 'Ensure CLI binary is correctly linked in package.json `bin`', priority: 'P0' }
  ];
  for (const item of npmItems) {
    const id = `prof-dist-${slugify(item.text)}`;
    lines.push(`- [${checkedState(model, id) ? 'x' : ' '}] ${priorityLabel(item.priority)} ${item.text} <!-- rs:task=${id} -->`);
  }
  lines.push('');

  lines.push('### Release Process');
  lines.push('');
  const releaseItems = [
    { text: 'Tag git releases aligned with npm publish', priority: 'P1' },
    { text: 'Document install instructions for npm global and npx usage', priority: 'P1' }
  ];
  for (const item of releaseItems) {
    const id = `prof-dist-${slugify(item.text)}`;
    lines.push(`- [${checkedState(model, id) ? 'x' : ' '}] ${priorityLabel(item.priority)} ${item.text} <!-- rs:task=${id} -->`);
  }
  lines.push('');
}

function renderSection10Documentation(model, lines) {
  lines.push(sectionHeader(10, 'Documentation Roadmap'));
  lines.push('');

  lines.push('### Core Docs');
  lines.push('');
  const coreItems = [
    { text: 'README.md covers install, commands, and profile selection', priority: 'P0' },
    { text: 'SKILL.md reflects current feature set and guardrails', priority: 'P0' },
    { text: 'CHANGELOG.md maintained for each release', priority: 'P1' }
  ];
  for (const item of coreItems) {
    const id = `prof-doc-${slugify(item.text)}`;
    lines.push(`- [${checkedState(model, id) ? 'x' : ' '}] ${priorityLabel(item.priority)} ${item.text} <!-- rs:task=${id} -->`);
  }
  lines.push('');

  lines.push('### Showcase');
  lines.push('');
  const showcaseItems = [
    { text: 'docs/ use-cases cover compact and professional profiles', priority: 'P1' },
    { text: 'Generated ROADMAP.md showcases professional Phase→Step→Task output', priority: 'P1' }
  ];
  for (const item of showcaseItems) {
    const id = `prof-doc-${slugify(item.text)}`;
    lines.push(`- [${checkedState(model, id) ? 'x' : ' '}] ${priorityLabel(item.priority)} ${item.text} <!-- rs:task=${id} -->`);
  }
  lines.push('');
}

function renderSection11Risks(model, lines) {
  lines.push(sectionHeader(11, 'Risks, Constraints, and Anti-Goals'));
  lines.push('');

  lines.push('### Risks');
  lines.push('');
  for (let i = 0; i < model.risks.length; i += 1) {
    const risk = model.risks[i];
    const pri = i === 0 ? 'P0' : 'P1';
    const id = `prof-risk-${slugify(risk)}`;
    lines.push(`- [${checkedState(model, id) ? 'x' : ' '}] ${priorityLabel(pri)} ${risk} <!-- rs:task=${id} -->`);
  }
  lines.push('');

  lines.push('### Anti-Goals');
  lines.push('');
  for (const antiGoal of model.antiGoals) {
    lines.push(`- ${antiGoal}`);
  }
  lines.push('');
}

function renderSection12SuccessCriteria(model, lines) {
  lines.push(sectionHeader(12, '1.0 Measurable Success Criteria'));
  lines.push('');

  const criteria = model.successCriteria && model.successCriteria.length > 0
    ? model.successCriteria
    : [
        'All roadmap sections render without errors for compact and professional profiles',
        'Checked task state is preserved across regeneration',
        'npm test passes with no failures',
        'ROADMAP.md is generated by RoadmapSmith itself'
      ];

  for (const criterion of criteria) {
    const id = `prof-sc-${slugify(criterion)}`;
    lines.push(`- [${checkedState(model, id) ? 'x' : ' '}] \`[P0]\` ${criterion} <!-- rs:task=${id} -->`);
  }
  lines.push('');
}

function renderProfessional(model) {
  const projectName = (model.product && model.product.name) || 'Project';
  const lines = [];

  lines.push(`# ${projectName} Roadmap`);
  lines.push('');

  renderSection1NorthStar(model, lines);
  renderSection2Positioning(model, lines);
  renderSection3CurrentState(model, lines);
  renderSection4PhasedExecution(model, lines);
  renderSection5Milestones(model, lines);
  renderSection6MaturityPath(model, lines);
  renderSection7OutputContract(model, lines);
  renderSection8Testing(model, lines);
  renderSection9Distribution(model, lines);
  renderSection10Documentation(model, lines);
  renderSection11Risks(model, lines);
  renderSection12SuccessCriteria(model, lines);

  return ensureTrailingNewline(lines.join('\n')).trimEnd();
}

module.exports = { renderProfessional };
