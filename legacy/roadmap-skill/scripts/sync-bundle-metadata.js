'use strict';

const { syncBundleMetadata } = require('./plugin-bundle');

const shouldWrite = process.argv.includes('--write');
const result = syncBundleMetadata({ write: shouldWrite });

if (!result.changed) {
  process.stdout.write(`Codex and Claude bundle metadata already matches package version ${result.version}.\n`);
  process.exit(0);
}

if (!shouldWrite) {
  process.stderr.write(
    `Codex and Claude bundle metadata does not match package version ${result.version}. Run "npm run sync-bundle-metadata".\n`
  );
  process.exit(1);
}

process.stdout.write(`Updated Codex and Claude bundle metadata to version ${result.version}.\n`);
