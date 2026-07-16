#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

// v1.0.0 breaking change: pre-v1 shipped a CLI (`roadmapsmith init`, `update`, etc).
// Someone doing `npm i -g roadmapsmith && roadmapsmith init` from muscle memory needs
// to know why nothing runs anymore — and how to get the legacy CLI back if they need it.
const LEGACY_SUBCMDS = ['init', 'update', 'verify', 'audit', 'sync', 'maintain', 'generate', 'add-task', 'doctor', 'migrate-markers'];
const arg = process.argv[2];

if (arg === '--version' || arg === '-v') {
  console.log(require('./package.json').version);
  process.exit(0);
}

if (arg && LEGACY_SUBCMDS.includes(arg)) {
  console.error('roadmapsmith v1.0.0 is a skill for Claude Code / Codex, not a CLI.');
  console.error('The `' + arg + '` subcommand was removed in v1.0.0.');
  console.error('');
  console.error('  For the new skill:  run `npx roadmapsmith` (no args) to install it,');
  console.error('                      then use /roadmap-init or /roadmap-update in your agent.');
  console.error('');
  console.error('  For the legacy CLI: npm i -g roadmapsmith@0.14');
  process.exit(2);
}

// Delegate to the skills.sh standard installer. It produces the full UX
// (agent auto-detect, box summary, security scan) and knows how to install
// to any of the 70+ supported agents.
const result = spawnSync(
  'npx',
  ['--yes', 'skills', 'add', __dirname, '--skill', 'roadmap-init', '--skill', 'roadmap-update'],
  { stdio: 'inherit', shell: true }
);
process.exit(result.status == null ? 1 : result.status);
