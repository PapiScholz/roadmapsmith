'use strict';

const fs = require('fs');
const path = require('path');
const { RELEASE_COMMIT_PATTERN } = require('./release-version');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const CHANGELOG_PATH = path.join(PACKAGE_ROOT, 'CHANGELOG.md');
const UNRELEASED_PLACEHOLDER = '- None yet.';
const SECTION_ORDER = ['Added', 'Fixed', 'Changed'];

function normalizeNewlines(text) {
  return String(text).replace(/\r\n/g, '\n');
}

function formatDate(date = new Date()) {
  return new Date(date).toISOString().slice(0, 10);
}

function isReleaseCommitSubject(subject) {
  return RELEASE_COMMIT_PATTERN.test(String(subject || '').trim());
}

function normalizeCommitEntry(subject) {
  // v0.13.7: strip trailing `(#123)` PR-merge ref so CHANGELOG bullets stay signal-only.
  const trimmed = String(subject || '').trim().replace(/\s*\(#\d+\)\s*$/, '');
  const match = /^([a-z]+)(?:\(([^)]+)\))?!?:\s*(.+)$/i.exec(trimmed);
  if (!match) {
    return trimmed;
  }

  const scope = match[2];
  const description = match[3].trim();
  return scope ? `(${scope}) ${description}` : description;
}

function classifyCommitSubject(subject) {
  const trimmed = String(subject || '').trim();
  if (!trimmed || isReleaseCommitSubject(trimmed)) {
    return null;
  }
  if (/^feat(?:\(.+\))?!?:\s+/i.test(trimmed)) {
    return 'Added';
  }
  if (/^fix(?:\(.+\))?!?:\s+/i.test(trimmed)) {
    return 'Fixed';
  }
  return 'Changed';
}

// v0.13.5: entries can be strings (legacy) or `{subject, body}` (with commit body).
// Pull the subject out either way.
function subjectOf(entry) {
  if (typeof entry === 'string') return entry;
  return entry && entry.subject ? String(entry.subject) : '';
}

// Extract the body sub-bullets from a commit body: only lines that already
// start with `- ` (dash + space) become CHANGELOG sub-bullets. Everything else
// is prose that shouldn't leak into the changelog.
function extractBodySubBullets(body) {
  if (!body) return [];
  return String(body)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^- \S/.test(line))
    .map((line) => line.replace(/^-\s+/, ''));
}

function groupCommitSubjects(subjects) {
  const groups = {
    Added: [],
    Fixed: [],
    Changed: []
  };

  (subjects || []).forEach((entry) => {
    const subject = subjectOf(entry);
    const section = classifyCommitSubject(subject);
    if (!section) {
      return;
    }
    groups[section].push({
      text: normalizeCommitEntry(subject),
      subBullets: extractBodySubBullets(typeof entry === 'string' ? '' : entry.body)
    });
  });

  return groups;
}

function buildReleaseSection(options = {}) {
  const {
    version,
    date = formatDate(),
    subjects = []
  } = options;

  if (!version) {
    throw new Error('buildReleaseSection requires a version.');
  }

  const groups = groupCommitSubjects(subjects);
  const lines = [`## v${version} - ${date}`, ''];
  let hasEntries = false;

  SECTION_ORDER.forEach((section) => {
    if (!groups[section] || groups[section].length === 0) {
      return;
    }
    hasEntries = true;
    lines.push(`### ${section}`);
    groups[section].forEach((entry) => {
      lines.push(`- ${entry.text}`);
      entry.subBullets.forEach((sub) => lines.push(`  - ${sub}`));
    });
    lines.push('');
  });

  if (!hasEntries) {
    lines.push('### Changed');
    lines.push('- Maintenance release.');
    lines.push('');
  }

  return lines.join('\n').trim();
}

function findSectionRange(content, heading) {
  const normalized = normalizeNewlines(content);
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headingRegex = new RegExp(`^## ${escapedHeading}\\s*$`, 'm');
  const match = headingRegex.exec(normalized);
  if (!match) {
    return null;
  }

  const start = match.index;
  const afterHeading = start + match[0].length;
  const rest = normalized.slice(afterHeading);
  const nextHeading = /\n## /g.exec(rest);
  const end = nextHeading ? afterHeading + nextHeading.index + 1 : normalized.length;

  return { start, end };
}

function updateChangelogContent(existingContent, options = {}) {
  const {
    version,
    date = formatDate(),
    subjects = []
  } = options;

  const normalized = normalizeNewlines(existingContent);
  let unreleasedRange = findSectionRange(normalized, 'Unreleased');
  if (!unreleasedRange) {
    // ponytail: auto-restore the missing Unreleased stub instead of throwing.
    // Hand-crafted release commits sometimes drop it; synthesize a zero-width range at the topmost `## ` heading.
    const firstRelease = /^## /m.exec(normalized);
    const insertAt = firstRelease ? firstRelease.index : normalized.length;
    unreleasedRange = { start: insertAt, end: insertAt };
  }

  const releaseSection = buildReleaseSection({ version, date, subjects });
  const nextBlock = `## Unreleased\n\n${UNRELEASED_PLACEHOLDER}\n\n${releaseSection}\n\n`;

  return `${normalized.slice(0, unreleasedRange.start)}${nextBlock}${normalized.slice(unreleasedRange.end).replace(/^\s+/, '')}`.trimEnd() + '\n';
}

function extractReleaseNotes(content, version) {
  const normalized = normalizeNewlines(content);
  const headingRegex = new RegExp(`^## v${String(version).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} - .+$`, 'm');
  const headingMatch = headingRegex.exec(normalized);
  if (!headingMatch) {
    return `Release v${version}`;
  }

  const start = headingMatch.index + headingMatch[0].length;
  const rest = normalized.slice(start);
  const nextHeading = /\n## /g.exec(rest);
  const end = nextHeading ? start + nextHeading.index + 1 : normalized.length;
  const section = normalized.slice(headingMatch.index, end).trim();
  return section;
}

function updateChangelog(options = {}) {
  const {
    packageRoot = PACKAGE_ROOT,
    version,
    date = formatDate(),
    subjects = [],
    write = false,
    existingContent
  } = options;

  const changelogPath = path.join(packageRoot, 'CHANGELOG.md');
  const content = typeof existingContent === 'string' ? existingContent : fs.readFileSync(changelogPath, 'utf8');
  const nextContent = updateChangelogContent(content, { version, date, subjects });

  if (write) {
    fs.writeFileSync(changelogPath, nextContent, 'utf8');
  }

  return {
    version,
    date,
    content: nextContent,
    notes: extractReleaseNotes(nextContent, version)
  };
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = argv.slice();
  const options = {
    version: '',
    date: formatDate(),
    subjects: [],
    write: false,
    json: false
  };

  while (args.length > 0) {
    const arg = args.shift();
    if (arg === '--write') {
      options.write = true;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--version') {
      options.version = args.shift() || '';
      continue;
    }
    if (arg === '--date') {
      options.date = args.shift() || options.date;
      continue;
    }
    if (arg === '--subject') {
      options.subjects.push(args.shift() || '');
      continue;
    }
    throw new Error(`Unknown argument "${arg}".`);
  }

  if (!options.version) {
    throw new Error('--version is required.');
  }

  return options;
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const result = updateChangelog(options);

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  process.stdout.write(result.notes + '\n');
}

if (require.main === module) {
  main();
}

module.exports = {
  CHANGELOG_PATH,
  PACKAGE_ROOT,
  SECTION_ORDER,
  UNRELEASED_PLACEHOLDER,
  buildReleaseSection,
  classifyCommitSubject,
  extractReleaseNotes,
  findSectionRange,
  formatDate,
  groupCommitSubjects,
  isReleaseCommitSubject,
  main,
  normalizeCommitEntry,
  normalizeNewlines,
  parseArgs,
  updateChangelog,
  updateChangelogContent
};
