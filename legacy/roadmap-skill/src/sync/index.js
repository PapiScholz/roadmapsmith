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

function formatSuccessEvidence(indent, text) {
  return `${indent}  - ✅ evidence: ${text}`;
}

function pickAutoCheckEvidenceText(result) {
  if (!result) return null;
  if (typeof result.discoveredEvidence === 'string' && result.discoveredEvidence.trim()) {
    return result.discoveredEvidence.trim();
  }
  const evidence = result.evidence || {};
  const symbols = Array.isArray(evidence.symbols) ? evidence.symbols.filter(Boolean) : [];
  if (symbols.length > 0) {
    return `symbols: ${symbols.slice(0, 3).join(', ')}`;
  }
  const testFiles = Array.isArray(evidence.testFiles) ? evidence.testFiles.filter(Boolean) : [];
  if (testFiles.length > 0) {
    return `test imports: ${testFiles.slice(0, 3).join(', ')}`;
  }
  return null;
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
  // Sort so back-to-back runs on unchanged repo state produce byte-identical warnings.
  normalized.sort((left, right) => left.localeCompare(right));
  return normalized;
}

function formatVerificationRecipe(indent, recipe) {
  return `${indent}  - Verification recipe: ${recipe}`;
}

function formatTestEvidence(indent, evidence) {
  return `${indent}  - Test evidence: ${evidence}`;
}

function findVerificationRecipeIndex(lines, taskLineIndex) {
  for (let index = taskLineIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim() || /^\s*#{2,}\s/.test(line) || /^\s*- \[[ xX]\]\s/.test(line)) break;
    if (/^\s*- Verification recipe:/i.test(line)) return index;
  }
  return null;
}

function applySync(content, parsedTasks, results, options) {
  const parsed = parseRoadmap(content);
  const lines = [...parsed.lines];
  const tasks = parsedTasks || parsed.tasks;

  const changes = {
    newlyUnchecked: [],
    newlyChecked: [],
    warningsAdded: [],
    warningsRemoved: []
  };

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

    const wasChecked = task.checked;
    const evidenceOnly = !!(options && options.evidenceOnly);
    if (!evidenceOnly) {
      lines[lineIndex] = setChecklistState(lines[lineIndex], result.passed);
      if (wasChecked && !result.passed) {
        changes.newlyUnchecked.push(task.id);
      } else if (!wasChecked && result.passed) {
        changes.newlyChecked.push(task.id);
      }
    }

    const reason = normalizeWarningReasons(result.reasons).join('; ');
    const warningText = formatWarning(task.indent || '', reason || 'validation failed', result.attempted);
    const hasWarning = task.warningLineIndex != null;
    const warningIndex = hasWarning ? task.warningLineIndex + offset : null;
    const lastChildLineIndex = (task.lastChildLineIndex != null ? task.lastChildLineIndex : task.lineIndex) + offset;
    const concise = !!(options && options.concise);

    // rs:planned or --concise: no warning line ever, and drop any pre-existing warning.
    if (result.planned || concise) {
      if (warningIndex != null && warningIndex >= 0 && warningIndex < lines.length) {
        lines.splice(warningIndex, 1);
        offset -= 1;
        changes.warningsRemoved.push(task.id);
      }
      continue;
    }

    if (result.passed) {
      if (warningIndex != null && warningIndex >= 0 && warningIndex < lines.length) {
        lines.splice(warningIndex, 1);
        offset -= 1;
      }
      const recipeIndex = findVerificationRecipeIndex(lines, lineIndex);
      if (recipeIndex != null && recipeIndex >= 0 && recipeIndex < lines.length) {
        lines.splice(recipeIndex, 1);
        offset -= 1;
      }
      if (
        result.generatedTestEvidence &&
        (!Array.isArray(task.testEvidenceLines) || task.testEvidenceLines.length === 0)
      ) {
        const insertionIndex = Math.max(lineIndex + 1, (task.lastChildLineIndex + offset) + 1);
        lines.splice(insertionIndex, 0, formatTestEvidence(task.indent || '', result.generatedTestEvidence));
        offset += 1;
      }
      if (
        result.staleEvidenceResolved &&
        (!Array.isArray(task.evidenceLines) || task.evidenceLines.length === 0) &&
        result.discoveredEvidence
      ) {
        const insertionIndex = Math.max(
          lineIndex + 1,
          (task.lastChildLineIndex + offset) + 1
        );
        lines.splice(insertionIndex, 0, `${task.indent || ''}  - Evidence: ${result.discoveredEvidence}`);
        offset += 1;
      }
      if (!wasChecked) {
        const hasExistingEvidence = Array.isArray(task.evidenceLines) && task.evidenceLines.length > 0;
        const alreadyInsertedTestEvidence = result.generatedTestEvidence
          && (!Array.isArray(task.testEvidenceLines) || task.testEvidenceLines.length === 0);
        const alreadyInsertedStaleEvidence = result.staleEvidenceResolved
          && (!Array.isArray(task.evidenceLines) || task.evidenceLines.length === 0)
          && result.discoveredEvidence;
        if (!hasExistingEvidence && !alreadyInsertedTestEvidence && !alreadyInsertedStaleEvidence) {
          const evidenceText = pickAutoCheckEvidenceText(result);
          if (evidenceText) {
            const insertionIndex = Math.max(lineIndex + 1, (task.lastChildLineIndex + offset) + 1);
            lines.splice(insertionIndex, 0, formatSuccessEvidence(task.indent || '', evidenceText));
            offset += 1;
            changes.evidenceMarkersAdded = changes.evidenceMarkersAdded || [];
            changes.evidenceMarkersAdded.push(task.id);
          }
        }
      }
    } else if (warningIndex != null && warningIndex >= 0 && warningIndex < lines.length) {
      // Always regenerate from the fresh validator reasons — no preservation of prior text.
      lines[warningIndex] = warningText;
    } else {
      lines.splice(lastChildLineIndex + 1, 0, warningText);
      offset += 1;
      changes.warningsAdded.push(task.id);
    }

    const recipeIndex = findVerificationRecipeIndex(lines, lineIndex);
    if (result.passed) {
      continue;
    }
    if (result.verificationRecipe) {
      const recipeLine = formatVerificationRecipe(task.indent || '', result.verificationRecipe);
      if (recipeIndex != null && recipeIndex >= 0 && recipeIndex < lines.length) {
        lines[recipeIndex] = recipeLine;
      } else {
        lines.splice(lastChildLineIndex + 1, 0, recipeLine);
        offset += 1;
      }
    } else if (recipeIndex != null && recipeIndex >= 0 && recipeIndex < lines.length) {
      lines.splice(recipeIndex, 1);
      offset -= 1;
    }
  }

  return { content: ensureTrailingNewline(lines.join('\n')), changes };
}

module.exports = {
  applySync
};
