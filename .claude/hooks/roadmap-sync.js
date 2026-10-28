#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

// .claude/hooks/ -> project root (two levels up)
const PROJECT_ROOT = path.resolve(__dirname, '../..');
// The CLI moved from roadmap-skill/ to legacy/roadmap-skill/, and `sync` became `update`.
// Pointing at the old path made this hook fail on every edit without anyone noticing.
const CLI = path.join(PROJECT_ROOT, 'legacy', 'roadmap-skill', 'bin', 'cli.js');
const LOCK_FILE = path.join(__dirname, '.sync.lock');

let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { data += chunk; });
process.stdin.on('end', () => {
  let filePath = '';
  try {
    const parsed = JSON.parse(data);
    filePath = (parsed && parsed.tool_input && parsed.tool_input.file_path) || '';
  } catch (_) {
    process.exit(0);
  }

  const normalised = filePath.replace(/\\/g, '/');
  if (!normalised || normalised.endsWith('/ROADMAP.md')) {
    process.exit(0);
  }

  if (fs.existsSync(LOCK_FILE)) {
    process.exit(0);
  }

  try {
    fs.writeFileSync(LOCK_FILE, String(process.pid));
    execFileSync(process.execPath, [CLI, 'update', '--project-root', PROJECT_ROOT, '--concise'], {
      stdio: 'inherit'
    });
  } catch (err) {
    process.stderr.write('roadmapsmith sync failed: ' + (err.message || String(err)) + '\n');
  } finally {
    try { fs.unlinkSync(LOCK_FILE); } catch (_) {}
  }
});
