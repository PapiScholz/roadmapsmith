'use strict';

const { slugify } = require('../utils');

const TASK_LINE_RE = /^(\s*)- \[( |x|X)\] (.*?)(?:\s*<!--\s*rs:task=([a-z0-9-]+)([^>]*)-->)?\s*$/;
const WARNING_RE = /^\s*-\s+⚠️ attempted but validation failed:\s*(.+?)\s*$/;
const EVIDENCE_RE = /^\s*-\s+Evidence:\s*(.+?)\s*$/i;
const HEADING_RE = /^#{2,3}\s+(.*)$/;

const MANAGED_START = '<!-- rs:managed:start -->';
const MANAGED_END = '<!-- rs:managed:end -->';

function getIndentWidth(text) {
  return String(text || '').replace(/\t/g, '    ').length;
}

function parseRoadmap(content) {
  const lines = String(content || '').split(/\r?\n/);
  const managedRange = findManagedRange(lines);
  const tasks = [];
  let section = '';

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      section = headingMatch[1].trim();
    }

    const taskMatch = line.match(TASK_LINE_RE);
    if (!taskMatch) {
      continue;
    }

    const indent = taskMatch[1] || '';
    const checked = taskMatch[2].toLowerCase() === 'x';
    const text = taskMatch[3].trim();
    const markerId = taskMatch[4] || null;
    const markerFlags = taskMatch[5] || '';
    const noTest = /\brs:no-test\b/i.test(markerFlags);
    const taskIndentWidth = getIndentWidth(indent);

    let warningLineIndex = null;
    let warningText = null;
    const evidenceLines = [];
    let lastChildLineIndex = index;
    for (let childIndex = index + 1; childIndex < lines.length; childIndex += 1) {
      const childLine = lines[childIndex];
      if (!childLine.trim()) {
        break;
      }
      if (HEADING_RE.test(childLine) || TASK_LINE_RE.test(childLine)) {
        break;
      }

      const childBulletMatch = childLine.match(/^(\s*)-\s+(.*)$/);
      if (!childBulletMatch) {
        break;
      }
      if (getIndentWidth(childBulletMatch[1] || '') <= taskIndentWidth) {
        break;
      }

      lastChildLineIndex = childIndex;

      const evidenceMatch = childLine.match(EVIDENCE_RE);
      if (evidenceMatch) {
        evidenceLines.push({
          lineIndex: childIndex,
          text: evidenceMatch[1].trim(),
          raw: childLine
        });
      }

      const warningMatch = childLine.match(WARNING_RE);
      if (warningMatch) {
        warningLineIndex = childIndex;
        warningText = warningMatch[1].trim();
      }
    }

    const id = markerId || slugify(text);
    tasks.push({
      id,
      text,
      checked,
      lineIndex: index,
      lastChildLineIndex,
      warningLineIndex,
      warningText,
      evidenceLines,
      markerId,
      noTest,
      indent,
      section
    });
  }

  return {
    lines,
    managedRange,
    hasManagedBlock: Boolean(managedRange),
    tasks
  };
}

function findManagedRange(lines) {
  let start = -1;
  let end = -1;

  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() === MANAGED_START) {
      start = i;
      continue;
    }
    if (lines[i].trim() === MANAGED_END) {
      end = i;
      break;
    }
  }

  if (start >= 0 && end >= 0 && start < end) {
    return { start, end };
  }
  return null;
}

function upsertManagedBlock(existingContent, managedBody) {
  const existing = String(existingContent || '');
  const lines = existing.split(/\r?\n/);
  const range = findManagedRange(lines);
  const bodyLines = managedBody.split(/\r?\n/);

  if (!range) {
    if (existing.trim().length === 0) {
      return [MANAGED_START, ...bodyLines, MANAGED_END].join('\n');
    }
    return `${existing.replace(/\s+$/, '')}\n\n${MANAGED_START}\n${managedBody}\n${MANAGED_END}`;
  }

  const prefix = lines.slice(0, range.start + 1);
  const suffix = lines.slice(range.end);
  return [...prefix, ...bodyLines, ...suffix].join('\n');
}

module.exports = {
  findManagedRange,
  parseRoadmap,
  upsertManagedBlock
};
