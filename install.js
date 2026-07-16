#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

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
