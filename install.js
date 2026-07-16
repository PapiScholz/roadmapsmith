#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const skills = ['roadmap-init', 'roadmap-update'];
const srcRoot = path.join(__dirname, 'plugins', 'roadmapsmith', 'skills');
const dstRoot = path.join(os.homedir(), '.claude', 'skills');

for (const name of skills) {
  const src = path.join(srcRoot, name, 'SKILL.md');
  const dstDir = path.join(dstRoot, name);
  const dst = path.join(dstDir, 'SKILL.md');
  fs.mkdirSync(dstDir, { recursive: true });
  fs.copyFileSync(src, dst);
  console.log('  installed: ' + dst);
}

console.log('');
console.log('roadmapsmith installed. Two slashcommands available in Claude Code:');
console.log('  /roadmap-init     una vez, al arrancar un repo');
console.log('  /roadmap-update   cuando quieras que refleje los cambios');
