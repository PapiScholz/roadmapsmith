const test = require('node:test');
const assert = require('node:assert/strict');
const { appModule } = require('../src/app');

test('app module returns ok', () => {
  assert.equal(appModule(), 'ok');
});
