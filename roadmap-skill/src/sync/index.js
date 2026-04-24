'use strict';

const { parseRoadmap } = require('../parser');
const { ensureTrailingNewline } = require('../utils');

function setChecklistState(line, checked) {
  return line.replace(/- \[( |x|X)\]/, `- [${checked ? 'x' : ' '}]`);
}

function formatWarning(indent, reason) {
  return `${indent}  - ⚠️ attempted but validation failed: ${reason}`;
}

function applySync(content, parsedTasks, results) {
  const parsed = parseRoadmap(content);
  const lines = [...parsed.lines];
  const tasks = parsedTasks || parsed.tasks;

  let offset = 0;
  for (const task of tasks) {
    const result = results[task.id];
    if (!result) {
      continue;
    }

    const lineIndex = task.lineIndex + offset;
    if (lineIndex < 0 || lineIndex >= lines.length) {
      continue;
    }

    lines[lineIndex] = setChecklistState(lines[lineIndex], result.passed);

    const reason = result.reasons.join('; ');
    const warningText = formatWarning(task.indent || '', reason || 'validation failed');
    const hasWarning = task.warningLineIndex != null;
    const warningIndex = hasWarning ? task.warningLineIndex + offset : null;

    if (result.passed || !result.attempted) {
      if (warningIndex != null && warningIndex >= 0 && warningIndex < lines.length) {
        lines.splice(warningIndex, 1);
        offset -= 1;
      }
      continue;
    }

    if (warningIndex != null && warningIndex >= 0 && warningIndex < lines.length) {
      lines[warningIndex] = warningText;
    } else {
      lines.splice(lineIndex + 1, 0, warningText);
      offset += 1;
    }
  }

  return ensureTrailingNewline(lines.join('\n'));
}

module.exports = {
  applySync
};
