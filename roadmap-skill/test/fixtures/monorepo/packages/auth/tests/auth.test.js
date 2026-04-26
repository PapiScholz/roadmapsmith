'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { authenticateUser } = require('../src/auth');

test('auth workspace module rejects missing credentials', () => {
  assert.equal(authenticateUser(null), false);
  assert.equal(authenticateUser({}), false);
});

test('auth workspace module accepts valid token', () => {
  assert.equal(authenticateUser({ token: 'abc123' }), true);
});
