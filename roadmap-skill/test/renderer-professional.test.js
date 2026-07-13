'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { renderBody } = require('../src/renderer');
const { createRoadmapModel } = require('../src/model');

function makeModel(overrides = {}) {
  const base = {
    northStar: 'Test north star',
    product: { name: 'Test', northStar: 'Test north star' },
    currentState: {
      implemented: ['10 files'],
      scaffold: [],
      knownLimitations: [],
      implementedSummary: '10 files',
      todoSummary: '0 TODOs',
      stackSummary: 'JavaScript'
    },
    phases: { P0: [], P1: [], P2: [] },
    phasesDetailed: [],
    milestones: [{ version: 'v1.0', goal: 'Done' }],
    commandBreakdown: [],
    exitCriteria: [],
    risks: [],
    antiGoals: [],
    successCriteria: [],
    customSections: [],
    checkedById: {}
  };
  const merged = { ...base, ...overrides };
  if (overrides.currentState) {
    merged.currentState = { ...base.currentState, ...overrides.currentState };
  }
  const model = createRoadmapModel(merged);
  if (overrides.moduleMetadata) {
    model.moduleMetadata = overrides.moduleMetadata;
  }
  return model;
}

test('scaffold tasks in Section 3 emit rs:kind=rollup marker', () => {
  const model = makeModel({
    currentState: { scaffold: ['Auth module'], knownLimitations: [] }
  });
  const output = renderBody(model);
  assert.match(
    output,
    /<!-- rs:task=prof-state-scaffold-auth-module rs:kind=rollup -->/,
    'Scaffold task must carry rs:kind=rollup so validator skips weak-evidence audit'
  );
});

test('known limitations in Section 3 emit rs:kind=rollup marker', () => {
  const model = makeModel({
    currentState: { scaffold: [], knownLimitations: ['DB pool leak under load'] }
  });
  const output = renderBody(model);
  assert.match(
    output,
    /<!-- rs:task=prof-state-limit-db-pool-leak-under-load rs:kind=rollup -->/,
    'Known limitation task must carry rs:kind=rollup'
  );
});

test('risks in Section 7 emit rs:kind=rollup marker', () => {
  const model = makeModel({ risks: ['Vendor lock-in'] });
  const output = renderBody(model);
  assert.match(
    output,
    /<!-- rs:task=prof-risk-vendor-lock-in rs:kind=rollup -->/,
    'Risk task must carry rs:kind=rollup'
  );
});

test('success criteria in Section 8 emit rs:kind=rollup marker', () => {
  const model = makeModel({ successCriteria: ['99.9% uptime'] });
  const output = renderBody(model);
  assert.match(
    output,
    /<!-- rs:task=prof-sc-99-9-uptime rs:kind=rollup -->/,
    'Success criterion task must carry rs:kind=rollup'
  );
});

test('Section 6 omits boilerplate tasks when moduleMetadata is empty', () => {
  const model = makeModel({ commandBreakdown: ['Module: auth'] });
  const output = renderBody(model);

  assert.match(output, /### auth/, 'Module header must still render');
  assert.match(
    output,
    /\*\*Current state:\*\* module detected in scan\. Add `moduleMetadata\.auth`/,
    'State line must point users to moduleMetadata config'
  );
  assert.doesNotMatch(
    output,
    /Document auth public API/,
    'Fallback "Document API" task must not be emitted when no moduleMetadata'
  );
  assert.doesNotMatch(
    output,
    /Add test coverage for auth/,
    'Fallback "Add test coverage" task must not be emitted when no moduleMetadata'
  );
});

test('Section 6 emits configured tasks when moduleMetadata provides them', () => {
  const model = makeModel({
    commandBreakdown: ['Module: auth'],
    moduleMetadata: {
      auth: {
        state: 'stable, hardened',
        tasks: [
          { id: 'auth-refactor-session', text: 'Refactor session store', priority: 'P1' }
        ]
      }
    }
  });
  const output = renderBody(model);

  assert.match(output, /\*\*Current state:\*\* stable, hardened/, 'Configured state must render');
  assert.match(
    output,
    /Refactor session store <!-- rs:task=auth-refactor-session -->/,
    'Configured task must render with its ID'
  );
  assert.doesNotMatch(
    output,
    /Document auth public API/,
    'Fallback task must not appear when moduleMetadata provides tasks'
  );
});
