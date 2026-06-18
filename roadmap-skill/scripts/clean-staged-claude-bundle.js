'use strict';

const { cleanStagedPluginBundle } = require('./plugin-bundle');

cleanStagedPluginBundle();
process.stdout.write('Cleaned staged Codex and Claude bundle files from the npm package surface.\n');
