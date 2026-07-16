#!/usr/bin/env node
'use strict';

// Root skills/ is source of truth. plugins/roadmapsmith/skills/ is a mirror
// consumed by install.js (npm tarball) and .github/workflows/hol-plugin-scanner.yml
// (Codex plugin scan). If you edit one file, run `npm run sync-skills` to update
// the other, or CI (mirror-check.yml) + prepublishOnly will fail loudly.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKILLS = ['roadmap-init', 'roadmap-update'];

const pairs = SKILLS.map(function (name) {
  return {
    name: name,
    source: path.join(ROOT, 'skills', name, 'SKILL.md'),
    mirror: path.join(ROOT, 'plugins', 'roadmapsmith', 'skills', name, 'SKILL.md')
  };
});

const mode = process.argv[2] || '--check';
if (mode !== '--check' && mode !== '--fix') {
  console.error('usage: node scripts/sync-skills.js [--check|--fix]');
  process.exit(2);
}

let drift = 0;
for (const pair of pairs) {
  const src = fs.readFileSync(pair.source, 'utf8');
  const mir = fs.existsSync(pair.mirror) ? fs.readFileSync(pair.mirror, 'utf8') : null;
  if (src === mir) continue;
  drift++;
  const rel = path.relative(ROOT, pair.mirror).split(path.sep).join('/');
  const srcRel = path.relative(ROOT, pair.source).split(path.sep).join('/');
  if (mode === '--fix') {
    fs.mkdirSync(path.dirname(pair.mirror), { recursive: true });
    fs.writeFileSync(pair.mirror, src);
    console.log('fixed: ' + rel + ' <- ' + srcRel);
  } else {
    console.error('out of sync: ' + rel);
    console.error('  source of truth: ' + srcRel);
  }
}

if (mode === '--check' && drift > 0) {
  console.error('');
  console.error(drift + ' skill file(s) out of sync. Run: npm run sync-skills');
  process.exit(1);
}
console.log(mode === '--fix' && drift === 0 ? 'already in sync' : (mode === '--check' ? 'in sync' : 'sync complete'));
