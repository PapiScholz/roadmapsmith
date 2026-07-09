'use strict';

const { parseRoadmap, upsertManagedBlock } = require('./parser');
const { slugify, escapeRegExp } = require('./utils');

const PHASE_LABEL_RE = /\[(P[0-2])\]/i;

function buildId(baseId, existingIds) {
  if (!existingIds.has(baseId)) return baseId;
  for (let n = 2; ; n += 1) {
    const candidate = `${baseId}-${n}`;
    if (!existingIds.has(candidate)) return candidate;
  }
}

function addTask(text, content, options = {}) {
  const defaultPhase = options.phase || 'P1';
  const parsed = parseRoadmap(String(content || ''));
  const existingIds = new Set(parsed.tasks.map((t) => t.id));

  const phaseMatch = text.match(PHASE_LABEL_RE);
  const phase = phaseMatch ? phaseMatch[1].toUpperCase() : defaultPhase;
  const cleanText = text.replace(PHASE_LABEL_RE, '').trim();

  const baseId = slugify(cleanText);
  const id = buildId(baseId, existingIds);

  const taskLine = `- [ ] ${cleanText} <!-- rs:task=${id} rs:planned -->`;

  const lines = String(content || '').split(/\r?\n/);
  const range = parsed.managedRange;

  let blockLines;
  if (range) {
    blockLines = lines.slice(range.start + 1, range.end);
  } else {
    blockLines = [];
  }

  const safePhase = escapeRegExp(phase);
  const phaseHeadingRe = new RegExp(`^###\\s+(?:Phase\\s+)?${safePhase}(?:\\s|$)`, 'i');
  const headingIdx = blockLines.findIndex((l) => phaseHeadingRe.test(l.trim()));

  if (headingIdx >= 0) {
    blockLines.splice(headingIdx + 1, 0, taskLine);
  } else {
    if (blockLines.length > 0 && blockLines[blockLines.length - 1].trim() !== '') {
      blockLines.push('');
    }
    blockLines.push(`### Phase ${phase}`);
    blockLines.push(taskLine);
  }

  const managedBody = blockLines.join('\n');
  return upsertManagedBlock(content, managedBody);
}

module.exports = { addTask };
