'use strict';

function taskLine(task) {
  return `- [${task.checked ? 'x' : ' '}] ${task.text} <!-- rs:task=${task.id} -->`;
}

function sectionHeader(n, title) {
  return `## ${n}. ${title}`;
}

function checkedState(model, id) {
  return Boolean(model.checkedById && model.checkedById[id]);
}

function priorityLabel(priority) {
  return priority ? `\`[${priority}]\`` : '';
}

module.exports = { taskLine, sectionHeader, checkedState, priorityLabel };
