'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveSlashInvocation, renderSlashPalette, getSlashSuggestions } = require('../src/slash');

test('resolveSlashInvocation returns palette for /roadmap', () => {
  const route = resolveSlashInvocation('/roadmap', []);
  assert.equal(route.kind, 'palette');
  assert.equal(route.source, '/roadmap');
  assert.ok(route.suggestions.length >= 9);
});

test('resolveSlashInvocation resolves namespaced direct slash aliases', () => {
  const route = resolveSlashInvocation('/roadmap-maintain', []);
  assert.equal(route.kind, 'execute');
  assert.equal(route.actionId, 'maintain');
});

test('resolveSlashInvocation keeps /roadmap-sync <action> as the legacy namespaced root', () => {
  const route = resolveSlashInvocation('/roadmap-sync', ['validate']);
  assert.equal(route.kind, 'execute');
  assert.equal(route.actionId, 'validate');
});

test('resolveSlashInvocation treats bare /roadmap-sync as palette help', () => {
  const route = resolveSlashInvocation('/roadmap-sync', []);
  assert.equal(route.kind, 'palette');
  assert.equal(route.source, '/roadmap-sync');
});

test('resolveSlashInvocation resolves /roadmap-update as the direct sync command', () => {
  const route = resolveSlashInvocation('/roadmap-update', []);
  assert.equal(route.kind, 'execute');
  assert.equal(route.actionId, 'sync');
});

test('resolveSlashInvocation keeps partial root queries in palette mode', () => {
  const route = resolveSlashInvocation('/roadmap', ['syn']);
  assert.equal(route.kind, 'palette');
  assert.equal(route.query, 'syn');
  assert.equal(route.suggestions.some((action) => action.id === 'sync'), true);
});

test('resolveSlashInvocation keeps unknown direct slash queries in palette mode', () => {
  const route = resolveSlashInvocation('/roadmap-syn', []);
  assert.equal(route.kind, 'palette');
  assert.equal(route.query, 'syn');
});

test('renderSlashPalette includes direct, router, and task examples', () => {
  const output = renderSlashPalette({ source: '/roadmap', suggestions: getSlashSuggestions('sync') });
  assert.match(output, /RoadmapSmith slash palette/);
  assert.match(output, /Router form:/);
  assert.match(output, /Classic CLI:/);
  assert.match(output, /\/roadmap-update/);
  assert.match(output, /\/roadmap-sync/);
  assert.match(output, /VS Code task:/);
});
