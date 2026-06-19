'use strict';

const { parseRoadmap } = require('../parser');
const { ensureTrailingNewline } = require('../utils');

const WARNING_REASON_PREFIX = 'attempted but validation failed:';

function setChecklistState(line, checked) {
  return line.replace(/- \[( |x|X)\]/, `- [${checked ? 'x' : ' '}]`);
}

function formatWarning(indent, reason) {
  return `${indent}  - ⚠️ attempted but validation failed: ${reason}`;
}

function normalizeWarningReason(reason) {
  let normalized = String(reason || '').trim();
  if (!normalized) {
    return '';
  }

  normalized = normalized.replace(/^⚠️\s*/, '').trim();
  const prefixIndex = normalized.indexOf(WARNING_REASON_PREFIX);
  if (prefixIndex >= 0) {
    normalized = normalized.slice(prefixIndex + WARNING_REASON_PREFIX.length).trim();
  }

  return normalized;
}

function normalizeWarningReasons(reasons) {
  const normalized = [];
  const seen = new Set();
  for (const reason of Array.isArray(reasons) ? reasons : [reasons]) {
    for (const chunk of String(reason || '').split(/\s*;\s*/)) {
      const clean = normalizeWarningReason(chunk);
      if (!clean || seen.has(clean)) {
        continue;
      }
      seen.add(clean);
      normalized.push(clean);
    }
  }
  return normalized;
}

function shouldPreserveExistingWarning(existingReason, newReason) {
  const cleanExisting = normalizeWarningReason(existingReason);
  const cleanNew = normalizeWarningReason(newReason) || 'validation failed';
  return cleanNew === 'validation failed' && cleanExisting && cleanExisting !== cleanNew;
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

    const reason = normalizeWarningReasons(result.reasons).join('; ');
    const warningText = formatWarning(task.indent || '', reason || 'validation failed');
    const hasWarning = task.warningLineIndex != null;
    const warningIndex = hasWarning ? task.warningLineIndex + offset : null;
    const lastChildLineIndex = (task.lastChildLineIndex != null ? task.lastChildLineIndex : task.lineIndex) + offset;

    if (result.passed || !result.attempted) {
      if (warningIndex != null && warningIndex >= 0 && warningIndex < lines.length) {
        lines.splice(warningIndex, 1);
        offset -= 1;
      }
      continue;
    }

    if (warningIndex != null && warningIndex >= 0 && warningIndex < lines.length) {
      const existingReason = lines[warningIndex].split('validation failed:')[1];
      const newReason = reason || 'validation failed';
      if (!shouldPreserveExistingWarning(existingReason, newReason)) {
        lines[warningIndex] = warningText;
      }
    } else {
      lines.splice(lastChildLineIndex + 1, 0, warningText);
      offset += 1;
    }
  }

  return ensureTrailingNewline(lines.join('\n'));
}

module.exports = {
  applySync
};
