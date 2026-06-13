'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveSlashInvocation, renderSlashPalette, getSlashSuggestions } = require('../src/slash');

test('resolveSlashInvocation returns palette for /road', () => {
  const route = resolveSlashInvocation('/road', []);
  assert.equal(route.kind, 'palette');
  assert.equal(route.source, '/road');
  assert.ok(route.suggestions.length >= 9);
});

test('resolveSlashInvocation resolves direct exact slash aliases', () => {
  const route = resolveSlashInvocation('/maintain', []);
  assert.equal(route.kind, 'execute');
  assert.equal(route.actionId, 'maintain');
});

test('resolveSlashInvocation resolves namespaced exact actions', () => {
  const route = resolveSlashInvocation('/roadmap-sync', ['validate']);
  assert.equal(route.kind, 'execute');
  assert.equal(route.actionId, 'validate');
});

test('resolveSlashInvocation keeps partial root queries in palette mode', () => {
  const route = resolveSlashInvocation('/road', ['syn']);
  assert.equal(route.kind, 'palette');
  assert.equal(route.query, 'syn');
  assert.equal(route.suggestions.some((action) => action.id === 'sync'), true);
});

test('resolveSlashInvocation keeps unknown direct slash queries in palette mode', () => {
  const route = resolveSlashInvocation('/syn', []);
  assert.equal(route.kind, 'palette');
  assert.equal(route.query, 'syn');
});

test('renderSlashPalette includes classic, skill, and task examples', () => {
  const output = renderSlashPalette({ source: '/road', suggestions: getSlashSuggestions('sync') });
  assert.match(output, /RoadmapSmith slash palette/);
  assert.match(output, /Classic CLI:/);
  assert.match(output, /Skill form: \/roadmap-sync/);
  assert.match(output, /VS Code task:/);
});
