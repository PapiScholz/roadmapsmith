#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

// .claude/hooks/ -> project root (two levels up)
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const CLI = path.join(PROJECT_ROOT, 'roadmap-skill', 'bin', 'cli.js');
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
    execFileSync(process.execPath, [CLI, 'sync', '--project-root', PROJECT_ROOT], {
      stdio: 'inherit'
    });
  } catch (err) {
    process.stderr.write('roadmapsmith sync failed: ' + (err.message || String(err)) + '\n');
  } finally {
    try { fs.unlinkSync(LOCK_FILE); } catch (_) {}
  }
});
