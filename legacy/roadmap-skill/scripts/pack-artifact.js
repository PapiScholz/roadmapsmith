'use strict';

const fs = require('fs');
const path = require('path');
const { PACKAGE_ROOT } = require('./claude-bundle');
const { runNpmPackJson } = require('./verify-pack-surface');

const packDestination = process.argv[2]
  ? path.resolve(process.argv[2])
  : PACKAGE_ROOT;

fs.mkdirSync(packDestination, { recursive: true });

const results = runNpmPackJson(packDestination);
const packResult = Array.isArray(results) ? results[0] : results;

if (!packResult || !packResult.filename) {
  throw new Error('npm pack did not report a filename.');
}

process.stdout.write(`${path.join(packDestination, packResult.filename)}\n`);
