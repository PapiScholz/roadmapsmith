'use strict';

const { slugify } = require('../utils');

const MANAGED_START = '<!-- rs:managed:start -->';
const MANAGED_END = '<!-- rs:managed:end -->';
const WARNING_PREFIX = '⚠️ attempted but validation failed:';

function getIndentWidth(text) {
  return String(text || '').replace(/\t/g, '    ').length;
}

function splitIndent(line) {
  const value = String(line || '');
  const trimmed = value.trimStart();
  return {
    indent: value.slice(0, value.length - trimmed.length),
    content: trimmed
  };
}

function parseHeadingLine(line) {
  const { content } = splitIndent(line);
  if (content.startsWith('## ')) {
    return content.slice(3).trim();
  }
  if (content.startsWith('### ')) {
    return content.slice(4).trim();
  }
  return null;
}

function parseTaskLine(line) {
  const { indent, content } = splitIndent(line);
  if (content.length < 6) return null;
  if (content[0] !== '-' || content[1] !== ' ' || content[2] !== '[') return null;

  const checkedToken = content[3];
  if (checkedToken !== ' ' && checkedToken !== 'x' && checkedToken !== 'X') return null;
  if (content[4] !== ']' || content[5] !== ' ') return null;

  let text = content.slice(6).trimEnd();
  let markerId = null;
  let markerFlags = '';

  const markerStart = text.lastIndexOf('<!--');
  if (markerStart >= 0 && text.endsWith('-->')) {
    const markerBody = text.slice(markerStart + 4, -3).trim();
    if (markerBody.startsWith('rs:task=')) {
      const markerPayload = markerBody.slice('rs:task='.length).trim();
      const markerParts = markerPayload.split(/\s+/).filter(Boolean);
      markerId = markerParts[0] || null;
      markerFlags = markerParts.slice(1).join(' ');
      text = text.slice(0, markerStart).trimEnd();
    }
  }

  return {
    indent,
    checked: checkedToken.toLowerCase() === 'x',
    text: text.trim(),
    markerId,
    markerFlags
  };
}

function parseChildBulletLine(line) {
  const { indent, content } = splitIndent(line);
  if (!content.startsWith('- ')) {
    return null;
  }
  return {
    indent,
    content: content.slice(2).trim()
  };
}

function parseEvidenceLine(content) {
  if (content.length < 9) return null;
  if (content.slice(0, 9).toLowerCase() !== 'evidence:') return null;
  return content.slice(9).trim();
}

function parseWarningLine(content) {
  if (!content.startsWith(WARNING_PREFIX)) return null;
  return content.slice(WARNING_PREFIX.length).trim();
}

function parseRoadmap(content) {
  const lines = String(content || '').split(/\r?\n/);
  const managedRange = findManagedRange(lines);
  const tasks = [];
  let section = '';

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const headingText = parseHeadingLine(line);
    if (headingText) {
      section = headingText;
    }

    const taskLine = parseTaskLine(line);
    if (!taskLine) {
      continue;
    }

    const { indent, checked, text, markerId, markerFlags } = taskLine;
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
      if (parseHeadingLine(childLine) || parseTaskLine(childLine)) {
        break;
      }

      const childBullet = parseChildBulletLine(childLine);
      if (!childBullet) {
        break;
      }
      if (getIndentWidth(childBullet.indent || '') <= taskIndentWidth) {
        break;
      }

      lastChildLineIndex = childIndex;

      const evidenceText = parseEvidenceLine(childBullet.content);
      if (evidenceText != null) {
        evidenceLines.push({
          lineIndex: childIndex,
          text: evidenceText,
          raw: childLine
        });
      }

      const warningTextValue = parseWarningLine(childBullet.content);
      if (warningTextValue != null) {
        warningLineIndex = childIndex;
        warningText = warningTextValue;
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
