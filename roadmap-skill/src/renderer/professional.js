'use strict';

const { slugify, ensureTrailingNewline } = require('../utils');
const { sectionHeader, checkedState, plannedState, priorityLabel } = require('./helpers');

function taskLineWithPriority(task, model) {
  const pri = task.priority ? `${priorityLabel(task.priority)} ` : '';
  const id = task.id || `prof-task-${slugify(task.text || String(task))}`;
  const text = task.text || String(task);
  const checked = task.checked || checkedState(model, id);
  const plannedFlag = plannedState(model, id) ? ' planned' : '';
  return `- [${checked ? 'x' : ' '}] ${pri}${text} <!-- rs:task=${id}${plannedFlag} -->`;
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
        const text = typeof item === 'string' ? item : item.text;
        const hasNote = typeof item === 'object' && Boolean(item.note);
        const note = hasNote ? ` — _${item.note}_` : '';
        const id = `prof-ms-${msSlug}-stable-${slugify(text)}`;
        const isChecked = checkedState(model, id);
        lines.push(`- [${isChecked ? 'x' : ' '}] \`[P1]\` ${text}${note} <!-- rs:task=${id} -->`);
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

function renderSection6MaturityPath(model, lines) {
  lines.push(sectionHeader(6, 'Command-by-Command / Module-by-Module Maturity Path'));
  lines.push('');

  const allAreas = [...model.commandBreakdown];

  if (allAreas.length === 0) {
    const id = 'prof-mat-identify-boundaries';
    const implSummary = (model.currentState && model.currentState.implementedSummary) || '';
    const hasDetectedFiles = /^[1-9]/.test(implSummary);
    const taskText = hasDetectedFiles
      ? `Define module boundaries (scanner detected files but no top-level structure)`
      : `Identify command/module boundaries for the next increment`;
    lines.push(`- [${checkedState(model, id) ? 'x' : ' '}] \`[P1]\` ${taskText} <!-- rs:task=${id} -->`);
    lines.push('');
    return;
  }

  const moduleMetadata = (model.moduleMetadata && typeof model.moduleMetadata === 'object') ? model.moduleMetadata : {};

  for (const area of allAreas) {
    const rawName = area.replace(/^(Module:|Command:)\s*/i, '').trim();
    const meta = moduleMetadata[rawName.toLowerCase()];
    const displayName = rawName;

    lines.push(`### ${displayName}`);
    lines.push('');
    if (meta && typeof meta === 'object') {
      lines.push(`**Current state:** ${meta.state}`);
      lines.push('');
      for (const task of (Array.isArray(meta.tasks) ? meta.tasks : [])) {
        lines.push(`- [${checkedState(model, task.id) ? 'x' : ' '}] ${priorityLabel(task.priority)} ${task.text} <!-- rs:task=${task.id} -->`);
      }
    } else {
      const isCommand = /^Command:/i.test(area);
      const kind = isCommand ? 'command' : 'module';
      const docId = `prof-mat-${slugify(rawName)}-document-api`;
      const testId = `prof-mat-${slugify(rawName)}-add-test-coverage`;
      lines.push(`**Current state:** ${kind} detected in scan.`);
      lines.push('');
      lines.push(`- [${checkedState(model, docId) ? 'x' : ' '}] \`[P1]\` Document ${displayName} public API <!-- rs:task=${docId} -->`);
      lines.push(`- [${checkedState(model, testId) ? 'x' : ' '}] \`[P1]\` Add test coverage for ${displayName} <!-- rs:task=${testId} -->`);
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
    { text: 'Version output format alongside package version', priority: 'P1' },
    { text: 'Define explicit contract for sync, sync --audit, and future promote-only flows', priority: 'P0' },
    { text: 'Document current gap: sync --audit is not yet a dedicated read-only audit command', priority: 'P1' },
    { text: 'Add machine-readable audit output (JSON)', priority: 'P1' },
    { text: 'Add audit summary-only output mode', priority: 'P1' },
    { text: 'Define explicit exit-code semantics for sync and audit commands', priority: 'P0' }
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
    { text: 'Add output schema validation to CI', priority: 'P1' },
    { text: 'Separate mutating sync behavior from future read-only audit mode', priority: 'P0' },
    { text: 'Expose weak-evidence, documentation-only, and structural-mismatch findings in audit output', priority: 'P1' }
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
    { text: 'Edge case coverage: empty repo, no config, large monorepo scan', priority: 'P1' },
    { text: 'Add direct tests for .claude/hooks/roadmap-sync.js payload parsing', priority: 'P1' },
    { text: 'Add direct tests for ROADMAP.md self-edit skip behavior', priority: 'P1' },
    { text: 'Add direct tests for lock-file reentry guard', priority: 'P1' },
    { text: 'Add direct tests for sync failure surfacing when the child process cannot be spawned', priority: 'P0' },
    { text: 'Add regression coverage for environments where node is not available on PATH', priority: 'P0' },
    { text: 'Add integration coverage for pre-commit sync using the absolute Node path', priority: 'P1' }
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
    { text: 'CHANGELOG.md maintained for each release', priority: 'P1' },
    { text: 'README.md documents current sync --audit semantics without claiming read-only behavior', priority: 'P0' },
    { text: 'README.md includes host matrix for Claude Code, Codex/Codex CLI, CI, and manual workflows', priority: 'P1' },
    { text: 'Document distinction between supported Claude hooks and manual workflows on other hosts', priority: 'P1' },
    { text: 'Document Codex/Codex CLI manual fallback workflow', priority: 'P1' },
    { text: 'Document Windows shell caveats: roadmapsmith.cmd, npm.cmd, and PowerShell policy differences', priority: 'P1' },
    { text: 'Skill instructions require extending existing phases before adding new ones', priority: 'P1' },
    { text: 'Document that Claude write-time autoupdate currently depends on Node resolution in the hook environment', priority: 'P1' },
    { text: 'Document the difference between the Claude PostToolUse hook and the git pre-commit hook', priority: 'P1' },
    { text: 'Document current autoupdate reliability boundaries: write-time hook is best-effort, pre-commit is stricter', priority: 'P1' },
    { text: 'Document troubleshooting for hook failure when node is missing from PATH', priority: 'P1' },
    { text: 'Document that Codex/Codex CLI remains manual and does not share the Claude repo-local hook path', priority: 'P1' }
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

function renderSection13CustomPhases(model, lines) {
  const phases = model.customPhases || [];
  if (phases.length === 0) {
    return;
  }

  lines.push(sectionHeader(13, 'Extended Phases'));
  lines.push('');

  const sorted = [...phases].sort((a, b) => a.phaseNumber - b.phaseNumber);
  for (const phase of sorted) {
    lines.push(`### Phase ${phase.phaseNumber}: ${phase.title}`);
    lines.push('');
    lines.push(`**Phase Priority:** ${priorityLabel(phase.priority)}`);
    lines.push(`**Objective:** ${phase.objective}`);
    lines.push('');

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
          const text = typeof item === 'string' ? item : item.text;
          const pri = (typeof item === 'object' && item.priority) ? `${priorityLabel(item.priority)} ` : '';
          const id = (typeof item === 'object' && item.id) ? item.id : `mkt-ph${phase.phaseNumber}-st${step.stepNumber}-exit-${slugify(text)}`;
          lines.push(`- [${checkedState(model, id) ? 'x' : ' '}] ${pri}${text} <!-- rs:task=${id} -->`);
        }
        lines.push('');
      }
    }
  }
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
  renderSection13CustomPhases(model, lines);

  for (const section of (model.customSections || [])) {
    lines.push(`## ${section.title}`);
    for (const line of section.items) {
      lines.push(line);
    }
    lines.push('');
  }

  return ensureTrailingNewline(lines.join('\n')).trimEnd();
}

module.exports = { renderProfessional };
