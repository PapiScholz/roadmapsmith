'use strict';

const { stagePluginBundle } = require('./plugin-bundle');

stagePluginBundle();
process.stdout.write('Staged Codex and Claude bundle files into the npm package surface.\n');
