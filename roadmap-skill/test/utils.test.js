'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { slugify } = require('../src/utils');

test('slugify: lowercases and converts spaces to hyphens', () => {
  assert.equal(slugify('hello world'), 'hello-world');
});

test('slugify: lowercases uppercase letters', () => {
  assert.equal(slugify('Core Complete'), 'core-complete');
});

test('slugify: already-valid slug is returned unchanged', () => {
  assert.equal(slugify('prof-ph1-st1-exit-core-complete'), 'prof-ph1-st1-exit-core-complete');
});

test('slugify: removes punctuation and collapses adjacent non-alphanumeric runs', () => {
  assert.equal(slugify('Hello, World!'), 'hello-world');
});

test('slugify: strips leading and trailing hyphens', () => {
  assert.equal(slugify('  leading and trailing  '), 'leading-and-trailing');
});

test('slugify: collapses interior multiple hyphens to one', () => {
  assert.equal(slugify('multiple---hyphens'), 'multiple-hyphens');
});

test('slugify: returns "task" fallback for empty string', () => {
  assert.equal(slugify(''), 'task');
});

test('slugify: returns "task" fallback for null', () => {
  assert.equal(slugify(null), 'task');
});
