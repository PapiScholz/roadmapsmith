'use strict';

function taskLine(task, planned = false) {
  const flag = planned ? ' planned' : '';
  return `- [${task.checked ? 'x' : ' '}] ${task.text} <!-- rs:task=${task.id}${flag} -->`;
}

function sectionHeader(n, title) {
  return `## ${n}. ${title}`;
}

function checkedState(model, id) {
  return Boolean(model.checkedById && model.checkedById[id]);
}

function plannedState(model, id) {
  return Boolean(model.plannedById && model.plannedById[id]);
}

function priorityLabel(priority) {
  return priority ? `\`[${priority}]\`` : '';
}

module.exports = { taskLine, sectionHeader, checkedState, plannedState, priorityLabel };
