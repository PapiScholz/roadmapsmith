'use strict';

const { slugify } = require('../utils');

const TASK_LINE_RE = /^(\s*)- \[( |x|X)\] (.*?)(?:\s*<!--\s*rs:task=([a-z0-9-]+)\s*-->)?\s*$/;
const WARNING_RE = /^\s*-\s+⚠️ attempted but validation failed:\s*(.+?)\s*$/;
const HEADING_RE = /^#{2,3}\s+(.*)$/;

const MANAGED_START = '<!-- rs:managed:start -->';
const MANAGED_END = '<!-- rs:managed:end -->';

function parseRoadmap(content) {
  const lines = String(content || '').split(/\r?\n/);
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

    let warningLineIndex = null;
    let warningText = null;
    if (index + 1 < lines.length) {
      const nextLine = lines[index + 1];
      const warningMatch = nextLine.match(WARNING_RE);
      if (warningMatch) {
        warningLineIndex = index + 1;
        warningText = warningMatch[1].trim();
      }
    }

    const id = markerId || slugify(text);
    tasks.push({
      id,
      text,
      checked,
      lineIndex: index,
      warningLineIndex,
      warningText,
      markerId,
      indent,
      section
    });
  }

  return {
    lines,
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
  MANAGED_END,
  MANAGED_START,
  parseRoadmap,
  upsertManagedBlock
};
