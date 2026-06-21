'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ROOT_README_PATH = path.join(REPO_ROOT, 'README.md');
const PACKAGE_README_PATH = path.join(REPO_ROOT, 'roadmap-skill', 'README.md');
const COMMAND_SURFACES_DOC_PATH = path.join(REPO_ROOT, 'docs', 'command-surfaces.md');
const SYNC_AUDIT_DOC_PATH = path.join(REPO_ROOT, 'docs', 'use-cases', 'sync-audit-mode.md');
const RELEASE_READINESS_DOC_PATH = path.join(REPO_ROOT, 'docs', 'release-readiness.md');
const RELEASE_UX_GATE_DOC_PATH = path.join(REPO_ROOT, 'docs', 'release-ux-gate.md');
const CI_AUDIT_DOC_PATH = path.join(REPO_ROOT, 'docs', 'use-cases', 'ci-audit.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('docs present status as the public readiness command and doctor as compatibility-only', () => {
  const combined = [read(ROOT_README_PATH), read(PACKAGE_README_PATH), read(COMMAND_SURFACES_DOC_PATH)].join('\n');

  assert.match(combined, /roadmapsmith status --json/);
  assert.match(combined, /doctor[\s\S]*compatibility/i);
});

test('docs present generate --full-regen as the public destructive path and regenerate as compatibility-only', () => {
  const combined = [read(PACKAGE_README_PATH), read(COMMAND_SURFACES_DOC_PATH)].join('\n');

  assert.match(combined, /generate --full-regen/);
  assert.match(combined, /regenerate/);
  assert.match(combined, /compatibility/i);
});

test('docs keep roadmap-sync as deprecated-only and recommend strict validation for independent audit', () => {
  const combined = [read(ROOT_README_PATH), read(PACKAGE_README_PATH), read(SYNC_AUDIT_DOC_PATH)].join('\n');

  assert.match(combined, /roadmap-sync/i);
  assert.match(combined, /deprecated/i);
  assert.match(combined, /validate --strict --json/);
  assert.match(combined, /not an independent audit engine/i);
});

test('docs present update as the public family and sync as the advanced alias', () => {
  const combined = [read(ROOT_README_PATH), read(PACKAGE_README_PATH), read(COMMAND_SURFACES_DOC_PATH)].join('\n');

  assert.match(combined, /update`? is the public .*family|public .*`update` family/i);
  assert.match(combined, /sync`? .*advanced alias|advanced alias for `?roadmapsmith update`?/i);
});

test('docs do not describe dist as heuristic implementation evidence', () => {
  const combined = [read(ROOT_README_PATH), read(PACKAGE_README_PATH), read(RELEASE_READINESS_DOC_PATH)].join('\n');

  assert.doesNotMatch(combined, /artifact presence \(README, CHANGELOG, docs\/, dist\/\)/i);
  assert.doesNotMatch(combined, /dist\/.*heuristic implementation evidence/i);
});

test('obsolete docs were removed after consolidation', () => {
  assert.equal(fs.existsSync(RELEASE_UX_GATE_DOC_PATH), false);
  assert.equal(fs.existsSync(CI_AUDIT_DOC_PATH), false);
});
