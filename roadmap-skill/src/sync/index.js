'use strict';

const { parseRoadmap } = require('../parser');
const { ensureTrailingNewline } = require('../utils');

const ATTEMPTED_WARNING_REASON_PREFIX = 'attempted but validation failed:';
const NO_EVIDENCE_WARNING_REASON_PREFIX = 'no implementation evidence found yet:';
const WARNING_REASON_PREFIXES = [
  ATTEMPTED_WARNING_REASON_PREFIX,
  NO_EVIDENCE_WARNING_REASON_PREFIX,
  'validation failed:'
];

function setChecklistState(line, checked) {
  return line.replace(/- \[( |x|X)\]/, `- [${checked ? 'x' : ' '}]`);
}

function formatWarning(indent, reason, attempted) {
  const prefix = attempted ? ATTEMPTED_WARNING_REASON_PREFIX : NO_EVIDENCE_WARNING_REASON_PREFIX;
  return `${indent}  - ⚠️ ${prefix} ${reason}`;
}

function isWhitespaceCharacter(char) {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === '\f' || char === '\v';
}

function stripLeadingWarningMarker(value) {
  let index = 0;
  const source = String(value || '');
  while (index < source.length && isWhitespaceCharacter(source[index])) {
    index += 1;
  }
  if (source.slice(index, index + 2) === '⚠️') {
    index += 2;
  }
  while (index < source.length && isWhitespaceCharacter(source[index])) {
    index += 1;
  }
  return source.slice(index);
}

function splitWarningReasonSegments(value) {
  const source = String(value || '');
  const segments = [];
  let current = '';
  let index = 0;

  while (index < source.length) {
    const char = source[index];
    if (char === ';') {
      const trimmed = current.trim();
      if (trimmed) {
        segments.push(trimmed);
      }
      current = '';
      index += 1;
      while (index < source.length && isWhitespaceCharacter(source[index])) {
        index += 1;
      }
      continue;
    }

    current += char;
    index += 1;
  }

  const trimmed = current.trim();
  if (trimmed) {
    segments.push(trimmed);
  }

  return segments;
}

function normalizeWarningReason(reason) {
  let normalized = String(reason || '').trim();
  if (!normalized) {
    return '';
  }

  normalized = stripLeadingWarningMarker(normalized).trim();
  for (const prefix of WARNING_REASON_PREFIXES) {
    const prefixIndex = normalized.indexOf(prefix);
    if (prefixIndex >= 0) {
      normalized = normalized.slice(prefixIndex + prefix.length).trim();
      break;
    }
  }

  return normalized;
}

function normalizeWarningReasons(reasons) {
  const normalized = [];
  const seen = new Set();
  for (const reason of Array.isArray(reasons) ? reasons : [reasons]) {
    for (const chunk of splitWarningReasonSegments(reason)) {
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
    const warningText = formatWarning(task.indent || '', reason || 'validation failed', result.attempted);
    const hasWarning = task.warningLineIndex != null;
    const warningIndex = hasWarning ? task.warningLineIndex + offset : null;
    const lastChildLineIndex = (task.lastChildLineIndex != null ? task.lastChildLineIndex : task.lineIndex) + offset;

    if (result.passed) {
      if (warningIndex != null && warningIndex >= 0 && warningIndex < lines.length) {
        lines.splice(warningIndex, 1);
        offset -= 1;
      }
      continue;
    }

    if (warningIndex != null && warningIndex >= 0 && warningIndex < lines.length) {
      const existingReason = normalizeWarningReason(lines[warningIndex]);
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
