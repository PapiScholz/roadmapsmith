'use strict';

const { slugify } = require('../utils');

const MANAGED_START = '<!-- rs:managed:start -->';
const MANAGED_END = '<!-- rs:managed:end -->';
const WARNING_PREFIX = '⚠️';
const WARNING_REASON_PREFIXES = [
  'attempted but validation failed:',
  'no implementation evidence found yet:',
  'validation failed:'
];

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
  if (content.startsWith('#### ')) {
    return content.slice(5).trim();
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

function parsePrefixedChildLine(content, prefix) {
  const normalizedPrefix = `${prefix}:`;
  if (content.slice(0, normalizedPrefix.length).toLowerCase() !== normalizedPrefix.toLowerCase()) {
    return null;
  }
  return content.slice(normalizedPrefix.length).trim();
}

function parseVerifyLine(content) {
  return parsePrefixedChildLine(content, 'Verify');
}

function parseTestEvidenceLine(content) {
  return parsePrefixedChildLine(content, 'Test evidence');
}

function parseVerificationRecipeLine(content) {
  return parsePrefixedChildLine(content, 'Verification recipe');
}

function parseWarningLine(content) {
  if (!content.startsWith(WARNING_PREFIX)) return null;
  let normalized = content.slice(WARNING_PREFIX.length).trim();
  for (const prefix of WARNING_REASON_PREFIXES) {
    if (normalized.startsWith(prefix)) {
      normalized = normalized.slice(prefix.length).trim();
      break;
    }
  }
  return normalized;
}

function parseBlockedByLine(content) {
  if (!/^blocked\s+by:/i.test(content)) return null;
  return content.replace(/^blocked\s+by:\s*/i, '').trim();
}

function parseRoadmap(content) {
  const lines = String(content || '').split(/\r?\n/);
  const managedRange = findManagedRange(lines);
  const tasks = [];
  const implicitIdCounts = new Map();
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
    const verifyLines = [];
    const testEvidenceLines = [];
    const explicitPendingItems = [];
    let verificationRecipeLineIndex = null;
    const blockedByIds = [];
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

      const verifyText = parseVerifyLine(childBullet.content);
      if (verifyText != null) {
        verifyLines.push({ lineIndex: childIndex, text: verifyText, raw: childLine });
      }

      const testEvidenceText = parseTestEvidenceLine(childBullet.content);
      if (testEvidenceText != null) {
        testEvidenceLines.push({ lineIndex: childIndex, text: testEvidenceText, raw: childLine });
      }

      const verificationRecipeText = parseVerificationRecipeLine(childBullet.content);
      if (verificationRecipeText != null) {
        verificationRecipeLineIndex = childIndex;
      }

      if (childBullet.content.startsWith('❌')) {
        explicitPendingItems.push({
          lineIndex: childIndex,
          text: childBullet.content.slice('❌'.length).trim()
        });
      }

      const warningTextValue = parseWarningLine(childBullet.content);
      if (warningTextValue != null) {
        warningLineIndex = childIndex;
        warningText = warningTextValue;
      }

      const blockedByText = parseBlockedByLine(childBullet.content);
      if (blockedByText !== null) {
        const ids = blockedByText.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
        blockedByIds.push(...ids);
      }
    }

    const baseId = markerId || slugify(text);
    const nextImplicitCount = markerId ? 1 : (implicitIdCounts.get(baseId) || 0) + 1;
    if (!markerId) {
      implicitIdCounts.set(baseId, nextImplicitCount);
    }
    const id = markerId || (nextImplicitCount === 1 ? baseId : `${baseId}-${nextImplicitCount}`);
    tasks.push({
      id,
      text,
      checked,
      lineIndex: index,
      lastChildLineIndex,
      warningLineIndex,
      warningText,
      evidenceLines,
      verifyLines,
      testEvidenceLines,
      verificationRecipeLineIndex,
      explicitPendingItems,
      blockedByIds,
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

function tasksInManagedBlock(parsedRoadmap) {
  if (!parsedRoadmap || !parsedRoadmap.managedRange) {
    return parsedRoadmap && Array.isArray(parsedRoadmap.tasks) ? parsedRoadmap.tasks : [];
  }

  const { start, end } = parsedRoadmap.managedRange;
  return parsedRoadmap.tasks.filter((task) => task.lineIndex > start && task.lineIndex < end);
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
    return `${existing.trimEnd()}\n\n${MANAGED_START}\n${managedBody}\n${MANAGED_END}`;
  }

  const prefix = lines.slice(0, range.start + 1);
  const suffix = lines.slice(range.end);
  return [...prefix, ...bodyLines, ...suffix].join('\n');
}

module.exports = {
  findManagedRange,
  parseRoadmap,
  tasksInManagedBlock,
  upsertManagedBlock
};
