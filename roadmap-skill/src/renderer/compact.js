'use strict';

const { slugify, ensureTrailingNewline } = require('../utils');
const { taskLine, checkedState } = require('./helpers');

function renderCompact(model) {
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

module.exports = { renderCompact };
