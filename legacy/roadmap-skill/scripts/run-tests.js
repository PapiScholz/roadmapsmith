'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const TEST_ROOT = path.join(PACKAGE_ROOT, 'test');

function listTopLevelTestFiles() {
  return fs.readdirSync(TEST_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.test.js'))
    .map((entry) => path.join('test', entry.name))
    .sort((left, right) => left.localeCompare(right));
}

function main() {
  const testFiles = listTopLevelTestFiles();

  if (testFiles.length === 0) {
    throw new Error(`No top-level test files found under ${TEST_ROOT}.`);
  }

  const result = spawnSync(process.execPath, ['--test', ...testFiles], {
    cwd: PACKAGE_ROOT,
    stdio: 'inherit'
  });

  if (result.error) {
    throw result.error;
  }

  process.exitCode = typeof result.status === 'number' ? result.status : 1;
}

if (require.main === module) {
  main();
}

module.exports = {
  listTopLevelTestFiles,
  main
};
