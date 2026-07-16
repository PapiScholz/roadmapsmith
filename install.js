#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

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

const skills = ['roadmap-init', 'roadmap-update'];
const srcRoot = path.join(__dirname, 'plugins', 'roadmapsmith', 'skills');
const home = os.homedir();

// Agent-agnostic: instala a cualquier directorio de skills que encuentre.
// Si ninguno existe, cae al default de Claude Code.
const agents = [
  { name: 'Claude Code', dir: path.join(home, '.claude', 'skills') },
  { name: 'Codex',       dir: path.join(home, '.codex', 'skills') }
];

function installTo(agentName, targetDir) {
  for (const skillName of skills) {
    const src = path.join(srcRoot, skillName, 'SKILL.md');
    const dstDir = path.join(targetDir, skillName);
    const dst = path.join(dstDir, 'SKILL.md');
    fs.mkdirSync(dstDir, { recursive: true });
    fs.copyFileSync(src, dst);
    console.log('  installed [' + agentName + ']: ' + dst);
  }
}

const installed = [];
for (const agent of agents) {
  const parent = path.dirname(agent.dir);
  if (!fs.existsSync(parent)) continue;
  installTo(agent.name, agent.dir);
  installed.push(agent.name);
}

if (installed.length === 0) {
  installTo('default: Claude Code', path.join(home, '.claude', 'skills'));
  installed.push('Claude Code');
}

console.log('');
console.log('roadmapsmith installed for: ' + installed.join(', '));
console.log('Two slashcommands available:');
console.log('  /roadmap-init     una vez, al arrancar un repo');
console.log('  /roadmap-update   cuando quieras que refleje los cambios');
