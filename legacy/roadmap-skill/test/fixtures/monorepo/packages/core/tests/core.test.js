'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { coreInit } = require('../src/core');

test('core workspace module initializes with defaults', () => {
  const result = coreInit();
  assert.equal(result.initialized, true);
  assert.deepEqual(result.options, {});
});

test('core workspace module forwards options', () => {
  const result = coreInit({ debug: true });
  assert.equal(result.options.debug, true);
});
